import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getDashboardPathForRole } from "@/lib/auth/validation";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/database";

const PROTECTED_PREFIXES = [
  "/admin",
  "/teacher",
  "/student",
  "/profile",
  "/calendar",
  "/messages",
] as const;
const AUTH_ENTRY_PATHS = ["/login", "/signup", "/forgot-password"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.some((entry) => pathname === entry);
}

function copySupabaseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

const PUBLIC_SKIP_PREFIXES = [
  "/api/health",
  "/api/contact",
  "/api/certificates/verify",
  "/privacy",
  "/terms",
  "/verify-certificate",
] as const;

function isPublicSkipPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_SKIP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the user's Supabase Auth token on incoming requests via `supabase.auth.getClaims()`,
 * enforces protected route authentication, blocks suspended accounts, and enforces role-based
 * route boundaries (`/admin`, `/teacher`, `/student`) using trusted `public.profiles` records.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // Fast path: skip auth/DB inspection on purely public pages and public API endpoints
  if (isPublicSkipPath(pathname)) {
    return supabaseResponse;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.value.length > 0);

  if (!hasAuthCookie) {
    if (isProtectedPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("reason", "session_expired");
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const env = getPublicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  if (!userId) {
    if (isProtectedPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("reason", "session_expired");
      return copySupabaseCookies(supabaseResponse, NextResponse.redirect(loginUrl));
    }
    return supabaseResponse;
  }

  // When a signed-in user accesses protected routes or auth entry pages, check their trusted database profile
  if (isProtectedPath(pathname) || isAuthEntryPath(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = "/login";
      suspendedUrl.searchParams.set("reason", "suspended");
      return copySupabaseCookies(supabaseResponse, NextResponse.redirect(suspendedUrl));
    }

    const trustedRole = profile?.role ?? "student";
    const roleDashboard = getDashboardPathForRole(trustedRole);

    if (isAuthEntryPath(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = roleDashboard;
      redirectUrl.search = "";
      return copySupabaseCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
    }

    // Role isolation on dashboard segments
    if (
      (pathname === "/admin" || pathname.startsWith("/admin/")) &&
      trustedRole !== "admin"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = roleDashboard;
      return copySupabaseCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
    }

    if (
      (pathname === "/teacher" || pathname.startsWith("/teacher/")) &&
      trustedRole !== "teacher" &&
      trustedRole !== "admin"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = roleDashboard;
      return copySupabaseCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
    }
  }

  return supabaseResponse;
}
