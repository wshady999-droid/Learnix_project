"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { findCountryByIso2 } from "@/lib/auth/countries";
import {
  getDashboardPathForRole,
  serverPhoneDigitsSchema,
  serverStrongPasswordSchema,
} from "@/lib/auth/validation";
import { getPublicEnv } from "@/lib/env";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { Json, ServiceResult, UserRole } from "@/types";

const REMEMBER_COOKIE_NAME = "learnix-remember-session";

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address.");

const loginPasswordSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().default(true),
});

const studentSignupServerSchema = z
  .object({
    accountType: z.literal("student"),
    fullName: z.string().trim().min(2).max(80),
    email: normalizedEmailSchema,
    countryIso2: z.string().trim().length(2),
    phone: serverPhoneDigitsSchema,
    password: serverStrongPasswordSchema,
    confirmPassword: z.string(),
    locale: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const teacherSignupServerSchema = z
  .object({
    accountType: z.literal("teacher"),
    fullName: z.string().trim().min(2).max(80),
    email: normalizedEmailSchema,
    countryIso2: z.string().trim().length(2),
    phone: serverPhoneDigitsSchema,
    password: serverStrongPasswordSchema,
    confirmPassword: z.string(),
    specialization: z.string().trim().min(3).max(120),
    qualifications: z.string().trim().min(20).max(2000),
    locale: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const signupUnionSchema = z.discriminatedUnion("accountType", [
  studentSignupServerSchema,
  teacherSignupServerSchema,
]);

async function recordSecurityEvent(params: {
  userId?: string | null;
  email?: string | null;
  eventType: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent") ?? "unknown";
    const ipAddress =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      null;

    after(async () => {
      try {
        const serviceClient = createSupabaseServiceRoleClient();
        const client = serviceClient ?? (await createSupabaseServerClient());
        await client.from("security_events").insert({
          user_id: params.userId ?? null,
          email: params.email ?? null,
          event_type: params.eventType,
          severity: params.severity ?? "info",
          description: params.description ?? null,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: (params.metadata ?? {}) as Json,
        });
      } catch {
        // Non-blocking security telemetry
      }
    });
  } catch {
    // Non-blocking security telemetry
  }
}

async function recordLoginActivity(params: {
  userId: string;
  email?: string | null;
  action: string;
  details?: Record<string, string | boolean | null>;
}) {
  try {
    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent") ?? "unknown";
    const ipAddress =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      null;
    const fingerprint = `${userAgent.slice(0, 120)}`;
    const supabase = await createSupabaseServerClient();

    after(async () => {
      try {
        const secType =
          params.action === "auth.login_password"
            ? "login_success"
            : params.action === "auth.login_blocked_suspended"
              ? "login_blocked_suspended"
              : params.action === "auth.password_updated"
                ? "password_changed"
                : params.action === "auth.logout"
                  ? "logout"
                  : params.action.includes("signup")
                    ? "signup"
                    : params.action;
        const severity =
          params.action === "auth.login_blocked_suspended" ? "high" : "info";

        await Promise.all([
          supabase.from("audit_logs").insert({
            actor_id: params.userId,
            action: params.action,
            entity_type: "auth",
            entity_id: params.userId,
            ip_address: ipAddress,
            user_agent: userAgent,
            new_values: (params.details ?? {}) as Json,
          }),
          supabase.from("security_events").insert({
            user_id: params.userId,
            email: params.email ?? null,
            event_type: secType,
            severity,
            description: `Authentication event: ${params.action}`,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: (params.details ?? {}) as Json,
          }),
          supabase.from("user_devices").upsert(
            {
              user_id: params.userId,
              device_fingerprint: fingerprint,
              browser: userAgent.slice(0, 80),
              last_active_at: new Date().toISOString(),
            },
            { onConflict: "user_id,device_fingerprint" },
          ),
        ]);
      } catch {
        // Non-blocking telemetry
      }
    });
  } catch {
    // Non-blocking telemetry
  }
}

export async function signInWithPasswordAction(
  input: z.infer<typeof loginPasswordSchema>,
): Promise<
  ServiceResult<{
    redirectTo: string;
    role: UserRole;
  }>
> {
  const parsed = loginPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid login input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: initialAuthData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

  let authenticatedUser = initialAuthData.user;

  if (authError || !authenticatedUser) {
    // If an account was created earlier while 'Confirm email' was enabled, auto-confirm it via Admin API and retry sign-in.
    if (authError?.message?.toLowerCase().includes("email not confirmed")) {
      const adminClient = createSupabaseServiceRoleClient();
      if (adminClient) {
        const { data: existingList } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const targetUser = existingList?.users.find(
          (u) => u.email?.toLowerCase() === parsed.data.email,
        );
        if (targetUser) {
          await adminClient.auth.admin.updateUserById(targetUser.id, {
            email_confirm: true,
          });
          const { data: retryData, error: retryError } =
            await supabase.auth.signInWithPassword({
              email: parsed.data.email,
              password: parsed.data.password,
            });
          if (!retryError && retryData.user) {
            authenticatedUser = retryData.user;
          } else {
            return { ok: false, error: "INVALID_CREDENTIALS" };
          }
        } else {
          return { ok: false, error: "INVALID_CREDENTIALS" };
        }
      } else {
        return {
          ok: false,
          error:
            "This account's email is still unconfirmed. Please paste your SUPABASE_SERVICE_ROLE_KEY in .env.local and restart your Next.js server so it can be auto-confirmed.",
        };
      }
    } else {
      await recordSecurityEvent({
        email: parsed.data.email,
        eventType: "login_failed",
        severity: "medium",
        description: `Failed password login attempt for ${parsed.data.email}`,
      });
      return {
        ok: false,
        error: "INVALID_CREDENTIALS",
      };
    }
  }

  const cookieStorePromise = cookies();
  const profilePromise = supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", authenticatedUser.id)
    .maybeSingle();

  const [cookieStore, { data: profile, error: profileError }] = await Promise.all([
    cookieStorePromise,
    profilePromise,
  ]);

  cookieStore.set(REMEMBER_COOKIE_NAME, parsed.data.rememberMe ? "persistent" : "session", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(parsed.data.rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { ok: false, error: "Unable to verify account profile." };
  }

  if (profile.status === "suspended") {
    await recordLoginActivity({
      userId: profile.id,
      action: "auth.login_blocked_suspended",
    });
    await supabase.auth.signOut();
    return { ok: false, error: "ACCOUNT_SUSPENDED" };
  }

  await recordLoginActivity({
    userId: profile.id,
    action: "auth.login_password",
    details: { role: profile.role, rememberMe: parsed.data.rememberMe },
  });

  return {
    ok: true,
    data: {
      role: profile.role,
      redirectTo: getDashboardPathForRole(profile.role),
    },
  };
}

function isDuplicateEmailError(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("duplicate key")
  );
}

export async function registerAccountAction(
  input: z.infer<typeof signupUnionSchema>,
): Promise<
  ServiceResult<{
    email: string;
    accountType: "student" | "teacher";
    userId: string;
    redirectTo: string;
  }>
> {
  const parsed = signupUnionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid registration details.",
    };
  }

  const adminClient = createSupabaseServiceRoleClient();
  if (!adminClient) {
    return {
      ok: false,
      error:
        "Server configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is empty in .env.local. Paste your service_role / secret key after SUPABASE_SERVICE_ROLE_KEY= in .env.local and restart the dev server (`npm run dev`).",
    };
  }

  const data = parsed.data;
  const normalizedEmail = data.email;
  const country = findCountryByIso2(data.countryIso2);
  const formattedPhone = `${country.dialCode}${data.phone}`;

  const metadata: Record<string, string> = {
    full_name: data.fullName,
    phone: formattedPhone,
    country_code: country.iso2,
    preferred_locale: data.locale,
    requested_account_type: data.accountType,
  };

  if (data.accountType === "teacher") {
    metadata.specialization = data.specialization;
    metadata.qualifications = data.qualifications;
  }

  let createdUserId: string | null = null;

  // Instant registration strictly via Admin API (Service Role Key):
  // Never calls `supabase.auth.signUp()`, so it never triggers confirmation emails or hits email send rate limits.
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: data.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (createError) {
    if (isDuplicateEmailError(createError)) {
      // Recover gracefully if the user was created in a previous attempt while 'Confirm email'
      // was enabled (leaving the user in an unconfirmed state).
      const { data: existingList } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existingUser = existingList?.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      );

      if (existingUser && !existingUser.email_confirmed_at) {
        const { error: confirmError } = await adminClient.auth.admin.updateUserById(
          existingUser.id,
          {
            password: data.password,
            email_confirm: true,
            user_metadata: {
              ...(typeof existingUser.user_metadata === "object" &&
              existingUser.user_metadata !== null
                ? existingUser.user_metadata
                : {}),
              ...metadata,
            },
          },
        );

        if (!confirmError) {
          createdUserId = existingUser.id;
        } else {
          return { ok: false, error: confirmError.message };
        }
      } else {
        return { ok: false, error: "EMAIL_ALREADY_EXISTS" };
      }
    } else {
      return { ok: false, error: createError.message };
    }
  } else {
    if (!created.user) {
      return { ok: false, error: "Unable to create account. Please try again." };
    }
    createdUserId = created.user.id;
  }

  if (!createdUserId) {
    return { ok: false, error: "Unable to create account. Please try again." };
  }

  // Immediately establish an authenticated session cookie on the server client AND verify the
  // authoritative profile role created by the database trigger in parallel.
  const supabase = await createSupabaseServerClient();
  const [signInResult, profileResult] = await Promise.all([
    supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: data.password,
    }),
    adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", createdUserId)
      .maybeSingle(),
  ]);

  const { error: signInError } = signInResult;

  if (signInError) {
    if (signInError.message.toLowerCase().includes("email not confirmed")) {
      await adminClient.auth.admin.updateUserById(createdUserId, {
        email_confirm: true,
      });
      const { error: retryError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: data.password,
      });
      if (retryError) {
        return { ok: false, error: retryError.message };
      }
    } else {
      return { ok: false, error: signInError.message };
    }
  }

  const effectiveRole: UserRole =
    profileResult.data?.role ??
    (data.accountType === "teacher" ? "teacher" : "student");

  await recordLoginActivity({
    userId: createdUserId,
    action:
      data.accountType === "teacher"
        ? "auth.signup_teacher_session_started"
        : "auth.signup_student_session_started",
    details: { role: effectiveRole },
  });

  return {
    ok: true,
    data: {
      email: normalizedEmail,
      accountType: data.accountType,
      userId: createdUserId,
      redirectTo: getDashboardPathForRole(effectiveRole),
    },
  };
}

/**
 * Initiates password recovery without revealing whether the email belongs to an existing account.
 */
export async function requestPasswordRecoveryAction(
  email: string,
): Promise<ServiceResult<{ sent: true }>> {
  const emailParsed = normalizedEmailSchema.safeParse(email);
  if (!emailParsed.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    const env = getPublicEnv();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(emailParsed.data, {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    });
  } catch {
    // Suppress upstream existence errors to prevent account enumeration.
  }

  return { ok: true, data: { sent: true } };
}

const updatePasswordInputSchema = z
  .object({
    password: serverStrongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export async function updatePasswordAction(
  input: z.infer<typeof updatePasswordInputSchema>,
): Promise<ServiceResult<{ updated: true }>> {
  const parsed = updatePasswordInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Password does not meet security requirements.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { ok: false, error: "Authentication session required to update password." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordLoginActivity({
    userId: claimsData.claims.sub,
    action: "auth.password_updated",
  });

  return { ok: true, data: { updated: true } };
}

export async function signOutAction(): Promise<ServiceResult<{ signedOut: true }>> {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (claimsData?.claims?.sub) {
    await recordLoginActivity({
      userId: claimsData.claims.sub,
      action: "auth.logout",
    });
  }

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_COOKIE_NAME);

  revalidatePath("/", "layout");
  return { ok: true, data: { signedOut: true } };
}

const updatePersonalProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  countryIso2: z.string().trim().length(2),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[\s()-]/g, "") : "")),
  bio: z.string().trim().max(500).optional(),
  specialization: z.string().trim().max(140).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export async function updatePersonalProfileAction(
  input: z.infer<typeof updatePersonalProfileSchema>,
): Promise<ServiceResult<{ updated: true }>> {
  const parsed = updatePersonalProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile data." };
  }

  if (parsed.data.phone && !/^\d{6,15}$/.test(parsed.data.phone)) {
    return { ok: false, error: "Phone number must contain 6 to 15 digits." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { ok: false, error: "Authentication required." };
  }

  const country = findCountryByIso2(parsed.data.countryIso2);
  const formattedPhone = parsed.data.phone ? `${country.dialCode}${parsed.data.phone}` : null;

  const updatePayload: {
    full_name: string;
    country_code: string;
    phone: string | null;
    bio: string | null;
    specialization?: string | null;
    avatar_url?: string | null;
  } = {
    full_name: parsed.data.fullName,
    country_code: country.iso2,
    phone: formattedPhone,
    bio: parsed.data.bio || null,
  };

  if (parsed.data.specialization !== undefined) {
    updatePayload.specialization = parsed.data.specialization || null;
  }

  if (parsed.data.avatarUrl !== undefined) {
    updatePayload.avatar_url = parsed.data.avatarUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", claimsData.claims.sub);

  if (error) return { ok: false, error: error.message };

  await recordLoginActivity({
    userId: claimsData.claims.sub,
    action: "profile.personal_info_updated",
  });

  revalidatePath("/profile");
  revalidatePath("/student/profile");
  revalidatePath("/teacher");
  revalidatePath("/admin");
  return { ok: true, data: { updated: true } };
}

const updatePreferencesSchema = z.object({
  preferredLocale: z.enum(["en", "ar", "de", "it", "fr"]),
  preferredTheme: z.enum(["light", "dark", "system"]),
  notifications: z.object({
    email_updates: z.boolean(),
    course_alerts: z.boolean(),
    exam_reminders: z.boolean(),
    grade_notifications: z.boolean(),
    security_alerts: z.boolean(),
  }),
});

export async function updateProfilePreferencesAction(
  input: z.infer<typeof updatePreferencesSchema>,
): Promise<ServiceResult<{ updated: true }>> {
  const parsed = updatePreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid preference settings." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { ok: false, error: "Authentication required." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_locale: parsed.data.preferredLocale,
      preferred_theme: parsed.data.preferredTheme,
      notification_preferences: parsed.data.notifications,
    })
    .eq("id", claimsData.claims.sub);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true, data: { updated: true } };
}
