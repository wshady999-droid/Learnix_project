import "server-only";

import { cache } from "react";
import { connection } from "next/server";

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
  fullName?: string | null;
  avatarUrl?: string | null;
  status?: Database["public"]["Enums"]["account_status"];
}

/**
 * Per-request cached resolution of the current caller's verified identity (`getClaims()`)
 * and `public.profiles` record. Deduplicates repeated auth + profile roundtrips across
 * layouts and parallel server data loaders within the same request.
 */
export const getCachedCallerProfile = cache(async () => {
  await connection();
  if (!isSupabaseConfigured()) {
    return { userId: null, profile: null, error: null as string | null };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
      return { userId: null, profile: null, error: null as string | null };
    }

    const userId = claimsData.claims.sub;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return { userId, profile: null, error: profileError.message };
    }

    return { userId, profile, error: null as string | null };
  } catch (err) {
    return {
      userId: null,
      profile: null,
      error: err instanceof Error ? err.message : "Failed to verify authenticated actor.",
    };
  }
});

/**
 * Resolves and verifies the current caller's identity via `supabase.auth.getClaims()`
 * and loads their authoritative role from `public.profiles`.
 * Never uses unverified `getSession()` on the server.
 */
export async function getAuthenticatedActor(): Promise<ServiceResult<AuthenticatedActor | null>> {
  const { userId, profile, error } = await getCachedCallerProfile();

  if (error) {
    return { ok: false, error };
  }

  if (!userId) {
    return { ok: true, data: null };
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
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      status: profile.status,
    },
  };
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
