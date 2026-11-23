import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, ServiceResult, UserRole } from "@/types";

export type TableName = keyof Database["public"]["Tables"];
export type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];

export interface AuthenticatedActor {
  userId: string;
  email: string | undefined;
  role: UserRole;
}

/**
 * Resolves and verifies the current caller's identity via `supabase.auth.getClaims()`
 * and loads their authoritative role from `public.profiles`.
 * Never uses unverified `getSession()` on the server.
 */
export async function getAuthenticatedActor(): Promise<ServiceResult<AuthenticatedActor | null>> {
  if (!isSupabaseConfigured()) {
    return { ok: true, data: null };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
      return { ok: true, data: null };
    }

    const userId = claimsData.claims.sub;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, role, status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return { ok: false, error: profileError.message };
    }

    if (!profile || profile.status !== "active") {
      return { ok: false, error: "Account is inactive or profile was not found." };
    }

    return {
      ok: true,
      data: {
        userId: profile.id,
        email: profile.email,
        role: profile.role,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to verify authenticated actor.",
    };
  }
}

export async function requireRole(
  allowedRoles: readonly UserRole[],
): Promise<ServiceResult<AuthenticatedActor>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) {
    return { ok: false, error: "Authentication required." };
  }
  if (!allowedRoles.includes(actorResult.data.role)) {
    return {
      ok: false,
      error: `Forbidden: requires role (${allowedRoles.join(", ")}).`,
    };
  }
  return { ok: true, data: actorResult.data };
}
