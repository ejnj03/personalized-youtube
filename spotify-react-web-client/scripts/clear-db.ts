/**
 * Wipe all spotify visitor state from Supabase — preferences, chat_turns,
 * and modes. The `sites` row is preserved. Visitors rows are preserved too
 * (cheap reference, not visitor-facing).
 *
 * After running, hard-refresh the browser. The chat panel will recreate a
 * "Default" mode on next mount.
 *
 * Run: npx tsx --env-file=../.env scripts/clear-db.ts
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: site } = await db.from('sites').select('id').eq('slug', 'spotify').single();
  if (!site) {
    console.log('no spotify sites row — nothing to clear');
    return;
  }

  // Order matters: chat_turns and preferences FK to modes (mode_id), so delete
  // them first, then modes. (FK has ON DELETE CASCADE too, so just clearing
  // modes would actually cascade — but we go explicit for clarity.)
  const { count: prefCount } = await db.from('preferences').delete({ count: 'exact' }).eq('site_id', site.id);
  const { count: turnCount } = await db.from('chat_turns').delete({ count: 'exact' }).eq('site_id', site.id);
  const { count: modeCount } = await db.from('modes').delete({ count: 'exact' }).eq('site_id', site.id);
  console.log(`Cleared spotify state:`);
  console.log(`  preferences: ${prefCount ?? 0}`);
  console.log(`  chat_turns:  ${turnCount ?? 0}`);
  console.log(`  modes:       ${modeCount ?? 0}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
