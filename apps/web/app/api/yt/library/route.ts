import { NextResponse } from 'next/server';
import { getLibrary } from '@/lib/innertube/client';

export const runtime = 'nodejs';

export async function GET() {
  const result = await getLibrary();
  if (result.kind !== 'ok') {
    return NextResponse.json({ ok: false, reason: result.reason ?? 'unavailable' }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    playlists: result.playlists,
    history: result.history,
  });
}
