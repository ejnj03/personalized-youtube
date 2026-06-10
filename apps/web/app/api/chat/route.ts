import { createNextHandler } from '@showcase/sdk/server';
import {
  supabasePersistence,
  loadSupabaseBaseConfig,
} from '@showcase/sdk/supabase';
import { host } from '@/lib/personalization';
import { fileLogger } from '@/lib/anthropic';
import { supabaseAdmin } from '@/lib/supabase';

const admin = supabaseAdmin();

// Module-init: load the real base config once via the SDK's Supabase helper.
// Falls back to `host.initialConfig` (the stub from personalization.ts) if
// the row is missing or the query errors — the chat handler stays functional,
// just with empty section snapshots. If you change sites.base_config in the
// DB, restart the dev server to pick it up.
const baseConfig =
  (await loadSupabaseBaseConfig(admin, host.initialConfig.slug)) ??
  host.initialConfig;

const serverHost = {
  ...host,
  logger: fileLogger,
  persistence: supabasePersistence(admin),
  initialConfig: baseConfig,
};

export const { POST, runtime, dynamic } = createNextHandler(serverHost);
