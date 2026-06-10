import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: site } = await db.from('sites').select('id, slug').eq('slug', 'spotify').single();
  console.log('spotify sites row:', site);
  if (site) {
    const { data: modes, count: modesCount } = await db
      .from('modes')
      .select('id, visitor_id, title, created_at', { count: 'exact' })
      .eq('site_id', site.id)
      .order('created_at', { ascending: true });
    console.log(`\nmodes (count=${modesCount}):`);
    console.log(JSON.stringify(modes, null, 2));
    const { data: prefs, count: prefsCount } = await db
      .from('preferences')
      .select('visitor_id, mode_id, patch, created_at', { count: 'exact' })
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(8);
    console.log(`\npreferences (count=${prefsCount}):`);
    console.log(JSON.stringify(prefs, null, 2));
    const { data: turns, count: turnsCount } = await db
      .from('chat_turns')
      .select('visitor_id, mode_id, user_message, created_at', { count: 'exact' })
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(8);
    console.log(`\nchat_turns (count=${turnsCount}):`);
    console.log(JSON.stringify(turns, null, 2));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
