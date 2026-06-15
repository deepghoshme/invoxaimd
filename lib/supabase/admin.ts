import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role Supabase client — BYPASSES RLS. Server-only (the `server-only`
 * import makes a client bundle that touches this file fail to build).
 *
 * Use deliberately and narrowly:
 *  - rendering public seller pages (anon has NO direct table read by design)
 *  - admin/cron jobs (wallet ledger, daily invoices)
 *  - webhook handlers that must write regardless of a user session
 *
 * Never expose its results to a user without re-checking authorization in code.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
