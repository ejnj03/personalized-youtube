import { NextResponse } from 'next/server';
import { getVideoInfo } from '@/lib/innertube/client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('v')?.trim() ?? '';
  if (videoId.length === 0 || videoId.length > 32) {
    return NextResponse.json({ ok: false, reason: 'invalid videoId' }, { status: 400 });
  }
  const result = await getVideoInfo(videoId);
  if (result.kind !== 'ok') {
    return NextResponse.json({ ok: false, reason: result.reason ?? 'unavailable' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, info: result.info });
}
