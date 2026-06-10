import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { persistence, resolveActiveModeId } from '@/lib/modes';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? 'streaming-platform';
  const modeId = url.searchParams.get('modeId');
  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  if (!visitorId) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const db = supabaseAdmin();
  const { data: site } = await db.from('sites').select('id').eq('slug', slug).single();
  if (!site) return NextResponse.json({ ok: true, deleted: 0 });

  // Reset only the ACTIVE mode — other save-slots keep their state.
  const activeModeId = await resolveActiveModeId(visitorId, slug, modeId);

  // Wipe this mode's patches (count for the response) + its chat transcript,
  // then log the reset as a turn so it appears in history on reload (parity
  // with the Spotify clone's /api/reset).
  const { count } = await db
    .from('preferences')
    .delete({ count: 'exact' })
    .eq('visitor_id', visitorId)
    .eq('site_id', site.id)
    .eq('mode_id', activeModeId);

  await db
    .from('chat_turns')
    .delete()
    .eq('visitor_id', visitorId)
    .eq('site_id', site.id)
    .eq('mode_id', activeModeId);

  await persistence.recordTurn(visitorId, slug, activeModeId, {
    userMessage: '',
    assistantMessage: 'Preferences reset.',
    toolUses: [],
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
