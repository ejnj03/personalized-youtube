import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { persistence, MODE_COOKIE } from '@/lib/modes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

// List the visitor's modes (save-slots) for this slug, plus which one is
// currently active (mode_id cookie, falling back to the oldest/Default).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? 'streaming-platform';
  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  if (!visitorId) return NextResponse.json({ modes: [], activeModeId: null });

  const modes = await persistence.listModes(visitorId, slug);
  const cookieMode = cookieStore.get(MODE_COOKIE)?.value;
  const activeModeId =
    (cookieMode && modes.some((m) => m.id === cookieMode) ? cookieMode : modes[0]?.id) ?? null;
  return NextResponse.json({ modes, activeModeId });
}

// Create a new mode and make it the active save-slot (sets the mode_id cookie).
export async function POST(req: Request) {
  type Body = { slug?: string; title?: string };
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.slug ?? 'streaming-platform';
  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  if (!visitorId) return NextResponse.json({ error: 'no visitor_id cookie' }, { status: 400 });
  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  try {
    const mode = await persistence.createMode(visitorId, slug, body.title.trim());
    const res = NextResponse.json({ mode });
    res.cookies.set(MODE_COOKIE, mode.id, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
