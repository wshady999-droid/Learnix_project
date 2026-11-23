import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client for Client Components.
 * Uses `@supabase/ssr` with the public publishable key (`sb_publishable_...`).
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
