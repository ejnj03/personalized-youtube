/**
 * Seed a 'spotify' row in the shared Supabase `sites` table.
 *
 * The supabasePersistence adapter looks up site_id by slug; without a row
 * here, writes silently no-op. Re-running upserts (idempotent).
 *
 * Run: pnpm seed
 */

import { setSupabaseBaseConfig } from '@showcase/sdk/supabase';
import { supabaseAdmin } from '../server/supabase';

const SLUG = 'spotify';

async function main() {
  // Minimal placeholder config — the spotify clone reads its real defaults
  // from src/personalization/host.ts (client) and server/host.ts (server).
  // The DB row's base_config is unused for spotify today; we still write a
  // valid shape so the row is well-formed for future use.
  await setSupabaseBaseConfig(supabaseAdmin(), SLUG, {
    id: 'spotify',
    slug: SLUG,
    theme: { accent: '#1db954', background: { from: 'rgb(66, 32, 35)' } },
    sections: [],
    filter: {},
    sort: {},
    meta: { title: 'Spotify', favicon: '/favicon.ico' },
  });
  console.log(`Seeded sites row for slug='${SLUG}'.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
