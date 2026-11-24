import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseServiceRoleKey, requireSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server Component / Server Action / Route Handler Supabase client.
 * Never expose secret keys to the client; this uses the publishable key and request cookies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` was invoked from a Server Component. Session refresh is handled in proxy.ts.
        }
      },
    },
  });
}

/**
 * Server-only Supabase Admin client initialized with SUPABASE_SERVICE_ROLE_KEY.
 * Use strictly in Server Actions / Route Handlers for admin operations like `auth.admin.createUser({ email_confirm: true })`.
 */
export function createSupabaseServiceRoleClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

