#!/usr/bin/env node
/**
 * Server-side idempotent CLI script to provision and verify Learnix administrators.
 *
 * Usage:
 *   node --env-file=.env.local scripts/provision-admins.mjs
 *   node --env-file=.env.local scripts/provision-admins.mjs --rotate
 *
 * Security rules:
 * - Reads credentials strictly from untracked environment variables (.env.local).
 * - Uses Supabase Auth Admin API with SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).
 * - Never hardcodes emails or passwords in source control and never logs passwords.
 * - Idempotent by default: existing users are verified without overwriting their passwords
 *   unless --rotate is explicitly passed.
 */

import { createClient } from "@supabase/supabase-js";

const REQUIRED_ADMIN_COUNT = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROTATE_EXISTING = process.argv.includes("--rotate");

function loadIdentities() {
  if (process.env.LEARNIX_ADMIN_ACCOUNTS_JSON) {
    const parsed = JSON.parse(process.env.LEARNIX_ADMIN_ACCOUNTS_JSON);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(
        "LEARNIX_ADMIN_ACCOUNTS_JSON must be a non-empty JSON array of admin objects.",
      );
    }
    return parsed;
  }

  const list = [];
  for (let i = 1; i <= REQUIRED_ADMIN_COUNT; i++) {
    const email = process.env[`LEARNIX_ADMIN_${i}_EMAIL`]?.trim();
    const password = process.env[`LEARNIX_ADMIN_${i}_PASSWORD`];
    const fullName =
      process.env[`LEARNIX_ADMIN_${i}_NAME`]?.trim() || `Learnix Administrator ${i}`;

    if (!email || !password) {
      throw new Error(
        `Missing LEARNIX_ADMIN_${i}_EMAIL or LEARNIX_ADMIN_${i}_PASSWORD in environment. Provide all ${REQUIRED_ADMIN_COUNT} admin identities in .env.local.`,
      );
    }

    list.push({ email, password, fullName });
  }
  return list;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) must be set in .env.local.",
    );
  }

  const identities = loadIdentities();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listErr) throw listErr;

  const existingByEmail = new Map(
    (existingList?.users ?? [])
      .filter((u) => Boolean(u.email))
      .map((u) => [u.email.toLowerCase(), u]),
  );

  let hasFailure = false;

  for (const [idx, admin] of identities.entries()) {
    const label = `Admin #${idx + 1} (${admin.email})`;

    if (!EMAIL_REGEX.test(admin.email)) {
      hasFailure = true;
      console.error(
        `[FAILED] ${label} -> Invalid email format (Supabase Auth requires a valid domain with TLD, e.g. name@admin.learnix.edu).`,
      );
      continue;
    }

    if (!admin.password || admin.password.length < 8) {
      hasFailure = true;
      console.error(`[FAILED] ${label} -> Password must be at least 8 characters.`);
      continue;
    }

    try {
      const existing = existingByEmail.get(admin.email.toLowerCase());
      let userId;
      let statusLabel;

      if (existing) {
        userId = existing.id;
        if (ROTATE_EXISTING) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
            password: admin.password,
            email_confirm: true,
          });
          if (updateErr) throw updateErr;
          statusLabel = "Rotated and verified";
        } else {
          statusLabel = "Already existed and verified";
        }
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: admin.email,
          password: admin.password,
          email_confirm: true,
          user_metadata: { full_name: admin.fullName },
        });
        if (createErr || !created?.user) {
          throw createErr || new Error("Supabase Auth did not return a created user.");
        }
        userId = created.user.id;
        statusLabel = "Created and verified";
      }

      // Check existing profile so we do not overwrite existing user fields unnecessarily
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, role, status, full_name")
        .eq("id", userId)
        .maybeSingle();

      if (!existingProfile) {
        const { error: insertErr } = await supabase.from("profiles").insert({
          id: userId,
          email: admin.email,
          full_name: admin.fullName,
          role: "admin",
          status: "active",
        });
        if (insertErr) throw insertErr;
      } else if (existingProfile.role !== "admin" || existingProfile.status !== "active") {
        const { error: updateProfileErr } = await supabase
          .from("profiles")
          .update({ role: "admin", status: "active" })
          .eq("id", userId);
        if (updateProfileErr) throw updateProfileErr;
      }

      // Verify assigned role & status from public.profiles
      const { data: verifiedProfile, error: verifyErr } = await supabase
        .from("profiles")
        .select("id, role, status")
        .eq("id", userId)
        .single();

      if (verifyErr || verifiedProfile.role !== "admin" || verifiedProfile.status !== "active") {
        throw new Error("Profile role verification failed (expected role=admin, status=active).");
      }

      if (statusLabel !== "Already existed and verified") {
        await supabase.from("audit_logs").insert({
          actor_id: userId,
          action:
            statusLabel === "Created and verified"
              ? "admin.provisioned"
              : "admin.password_rotated",
          entity_type: "profiles",
          entity_id: userId,
          new_values: { email: admin.email, role: "admin", status: statusLabel },
        });
      }

      console.log(`[OK] ${label} (${userId}) -> ${statusLabel} (role=${verifiedProfile.role}, status=${verifiedProfile.status})`);
    } catch (err) {
      hasFailure = true;
      console.error(`[FAILED] ${label} -> ${err?.message || err}`);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[ERROR] Admin provisioning aborted:", err?.message || err);
  process.exit(1);
});
