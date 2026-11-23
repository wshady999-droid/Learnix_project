import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { serverStrongPasswordSchema } from "@/lib/auth/validation";
import type { Database, ServiceResult } from "@/types";

export const REQUIRED_PREDEFINED_ADMIN_COUNT = 6;

const adminIdentitySchema = z.object({
  email: z.string().trim().email("Admin email must be a valid email address."),
  password: serverStrongPasswordSchema,
  fullName: z.string().trim().min(2).max(80),
});

export type AdminProvisionIdentity = z.infer<typeof adminIdentitySchema>;

export interface ProvisionedAdminSummary {
  email: string;
  userId: string;
  operation: "created" | "rotated";
}

/**
 * Loads the 6 predefined administrator identities from server-only environment variables.
 * Supports either `LEARNIX_ADMIN_ACCOUNTS_JSON` or indexed `LEARNIX_ADMIN_1_*` .. `LEARNIX_ADMIN_6_*`.
 * Never exposed to client bundles (`server-only`) and never committed to Git.
 */
export function loadAdminIdentitiesFromServerEnv(): ServiceResult<AdminProvisionIdentity[]> {
  const jsonRaw = process.env.LEARNIX_ADMIN_ACCOUNTS_JSON;
  if (jsonRaw) {
    try {
      const parsedJson: unknown = JSON.parse(jsonRaw);
      const arraySchema = z
        .array(adminIdentitySchema)
        .length(
          REQUIRED_PREDEFINED_ADMIN_COUNT,
          `Exactly ${REQUIRED_PREDEFINED_ADMIN_COUNT} predefined administrator identities are required.`,
        );
      const validated = arraySchema.safeParse(parsedJson);
      if (!validated.success) {
        return {
          ok: false,
          error: validated.error.issues[0]?.message ?? "Invalid LEARNIX_ADMIN_ACCOUNTS_JSON format.",
        };
      }
      return { ok: true, data: validated.data };
    } catch {
      return { ok: false, error: "LEARNIX_ADMIN_ACCOUNTS_JSON is not valid JSON." };
    }
  }

  const identities: AdminProvisionIdentity[] = [];
  for (let i = 1; i <= REQUIRED_PREDEFINED_ADMIN_COUNT; i++) {
    const email = process.env[`LEARNIX_ADMIN_${i}_EMAIL`];
    const password = process.env[`LEARNIX_ADMIN_${i}_PASSWORD`];
    const fullName = process.env[`LEARNIX_ADMIN_${i}_NAME`] || `Learnix Administrator ${i}`;

    if (!email || !password) {
      return {
        ok: false,
        error: `Missing server environment variables LEARNIX_ADMIN_${i}_EMAIL or LEARNIX_ADMIN_${i}_PASSWORD (all ${REQUIRED_PREDEFINED_ADMIN_COUNT} admin slots must be provided privately in .env.local).`,
      };
    }

    const checked = adminIdentitySchema.safeParse({ email, password, fullName });
    if (!checked.success) {
      return {
        ok: false,
        error: `Admin #${i} (${email}): ${checked.error.issues[0]?.message ?? "Invalid credentials."}`,
      };
    }

    identities.push(checked.data);
  }

  return { ok: true, data: identities };
}

/**
 * Server-only provisioning and password rotation for the 6 predefined platform administrators.
 * Requires `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`).
 */
export async function provisionPredefinedAdmins(options?: {
  rotateExistingPasswords?: boolean;
}): Promise<ServiceResult<ProvisionedAdminSummary[]>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return {
      ok: false,
      error:
        "Missing NEXT_PUBLIC_SUPABASE_URL or server-only SUPABASE_SERVICE_ROLE_KEY in environment.",
    };
  }

  const identitiesResult = loadAdminIdentitiesFromServerEnv();
  if (!identitiesResult.ok) return identitiesResult;

  const adminClient = createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: existingList, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return { ok: false, error: listError.message };
  }

  const existingByEmail = new Map(
    (existingList?.users ?? [])
      .filter((u) => Boolean(u.email))
      .map((u) => [u.email!.toLowerCase(), u]),
  );

  const summaries: ProvisionedAdminSummary[] = [];

  for (const identity of identitiesResult.data) {
    const normalizedEmail = identity.email.toLowerCase();
    const existingUser = existingByEmail.get(normalizedEmail);
    let userId: string;
    let operation: "created" | "rotated";

    if (existingUser) {
      userId = existingUser.id;
      operation = "rotated";

      if (options?.rotateExistingPasswords !== false) {
        const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(userId, {
          password: identity.password,
          email_confirm: true,
          user_metadata: {
            full_name: identity.fullName,
          },
        });
        if (updateAuthErr) {
          return {
            ok: false,
            error: `Failed to rotate credentials for ${identity.email}: ${updateAuthErr.message}`,
          };
        }
      }
    } else {
      operation = "created";
      const { data: createdAuth, error: createAuthErr } =
        await adminClient.auth.admin.createUser({
          email: identity.email,
          password: identity.password,
          email_confirm: true,
          user_metadata: {
            full_name: identity.fullName,
          },
        });

      if (createAuthErr || !createdAuth.user) {
        return {
          ok: false,
          error: `Failed to create admin user ${identity.email}: ${createAuthErr?.message ?? "Unknown error"}`,
        };
      }

      userId = createdAuth.user.id;
    }

    // Enforce server-side 'admin' role assignment in public.profiles
    const { error: profileUpsertErr } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        email: identity.email,
        full_name: identity.fullName,
        role: "admin",
        status: "active",
      },
      { onConflict: "id" },
    );

    if (profileUpsertErr) {
      return {
        ok: false,
        error: `Failed to assign admin role in profiles for ${identity.email}: ${profileUpsertErr.message}`,
      };
    }

    await adminClient.from("audit_logs").insert({
      actor_id: userId,
      action: operation === "created" ? "admin.provisioned" : "admin.password_rotated",
      entity_type: "profiles",
      entity_id: userId,
      new_values: { email: identity.email, role: "admin", operation },
    });

    summaries.push({
      email: identity.email,
      userId,
      operation,
    });
  }

  return { ok: true, data: summaries };
}
