import { NextResponse, type NextRequest } from "next/server";

import { getDashboardPathForRole } from "@/lib/auth/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles OAuth (Google) PKCE code exchange and email confirmation / recovery links.
 * Always resolves the user's authoritative role from `public.profiles` before redirecting.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !sessionData.user) {
    return NextResponse.redirect(new URL("/login?reason=session_expired", origin));
  }

  // If the callback explicitly targets password reset, allow /reset-password
  if (nextParam === "/reset-password") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  // Query authoritative role and status from public.profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", sessionData.user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.redirect(new URL("/student", origin));
  }

  if (profile.status === "suspended") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?reason=suspended", origin));
  }

  // Record OAuth login activity
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "auth.oauth_callback_login",
    entity_type: "auth",
    entity_id: profile.id,
    user_agent: request.headers.get("user-agent") ?? "unknown",
  });

  const destination = getDashboardPathForRole(profile.role);
  return NextResponse.redirect(new URL(destination, origin));
}
