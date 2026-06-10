import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy admin client factory — mirrors YT's apps/web/lib/supabase.ts.
 * Reads URL + service-role key from env (provided by --env-file=../.env).
 *
 * Server-only: NEVER import this from client code. The service role key
 * bypasses RLS and has full write access.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'supabaseAdmin: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env',
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
