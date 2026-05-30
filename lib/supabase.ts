import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Supabase data-plane client (PostgREST over HTTPS). This is how the app talks
 * to the database — NOT a direct Postgres socket. It reaches
 * https://<ref>.supabase.co on port 443, which is IPv4-reachable, so it sidesteps
 * the IPv6-only direct-Postgres host (db.<ref>.supabase.co) entirely.
 *
 * Uses the SERVICE ROLE key: server-only, bypasses Row Level Security. Every
 * caller here runs server-side (route handlers + the BullMQ worker), so this is
 * the correct trusted-backend key. It must NEVER be exposed to the browser —
 * keep it out of any NEXT_PUBLIC_ var and out of Client Components.
 *
 * The client is stashed on globalThis so Next.js dev reloads (and the worker
 * process) reuse a single instance instead of leaking connections.
 */
const globalForSupabase = globalThis as unknown as {
  __payrollSupabase?: SupabaseClient;
};

export function getSupabase(): SupabaseClient {
  if (!globalForSupabase.__payrollSupabase) {
    globalForSupabase.__payrollSupabase = createClient(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return globalForSupabase.__payrollSupabase;
}
