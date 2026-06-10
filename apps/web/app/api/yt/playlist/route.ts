import { NextResponse } from 'next/server';
import { getPlaylistVideos } from '@/lib/innertube/client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') ?? '').trim();
  if (id.length === 0 || id.length > 64) {
    return NextResponse.json({ ok: false, reason: 'invalid id' }, { status: 400 });
  }
  const result = await getPlaylistVideos(id);
  if (result.kind !== 'ok') {
    return NextResponse.json({ ok: false, reason: result.reason ?? 'unavailable' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, info: result.info, videos: result.videos });
}
