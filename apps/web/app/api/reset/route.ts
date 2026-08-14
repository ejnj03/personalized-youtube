import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

  // Reset only the ACTIVE mode — other save-slots keep their state.
  const activeModeId = await resolveActiveModeId(visitorId, slug, modeId);

  // Count before wiping so the response can report it. `reset` clears this
  // mode's patches AND its chat transcript in one call, replacing what used to
  // be two hand-written deletes against `preferences` and `chat_turns`.
  const deleted = (await persistence.read(visitorId, slug, activeModeId)).length;
  await persistence.reset(visitorId, slug, activeModeId);

  // Log the reset as a turn so it appears in history on reload (parity with
  // the Spotify clone's /api/reset).
  await persistence.recordTurn(visitorId, slug, activeModeId, {
    userMessage: '',
    assistantMessage: 'Preferences reset.',
    toolUses: [],
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, deleted });
}
