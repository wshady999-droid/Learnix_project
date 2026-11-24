import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server-only Supabase Admin client using SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).
 * NEVER import this module in client components or expose service-role credentials to the browser.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = getSupabaseServiceRoleKey();

  if (!url || !serviceKey) {
    return null;
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}


