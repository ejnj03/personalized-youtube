import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { persistence, MODE_COOKIE } from '@/lib/modes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

// Switch the visitor's active mode (save-slot). Sets the mode_id cookie that
// the SSR page loader + write routes read. The frontend calls this when the
// visitor clicks a different mode pill; the next page load reflects that slot.
export async function POST(req: Request) {
  type Body = { slug?: string; modeId?: string };
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.slug ?? 'streaming-platform';
  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  if (!visitorId) return NextResponse.json({ error: 'no visitor_id cookie' }, { status: 400 });
  if (!body.modeId) return NextResponse.json({ error: 'modeId required' }, { status: 400 });

  // Only activate a mode that actually belongs to this visitor.
  const modes = await persistence.listModes(visitorId, slug);
  if (!modes.some((m) => m.id === body.modeId)) {
    return NextResponse.json({ error: 'unknown mode' }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, activeModeId: body.modeId });
  res.cookies.set(MODE_COOKIE, body.modeId, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  return res;
}
