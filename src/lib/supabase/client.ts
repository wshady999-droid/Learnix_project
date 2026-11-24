import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client for Client Components.
 * Uses `@supabase/ssr` with the public publishable key (`sb_publishable_...`).
 * Memoized as a singleton on the client to prevent redundant auth/realtime instances.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  if (typeof window === "undefined") {
    return createBrowserClient<Database>(url, publishableKey);
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }
  return browserClient;
}
