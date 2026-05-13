import { NextResponse } from 'next/server';
import { getSubscriptionsFeed } from '@/lib/innertube/client';

export const runtime = 'nodejs';

export async function GET() {
  const result = await getSubscriptionsFeed();
  if (result.kind !== 'ok') {
    return NextResponse.json({ ok: false, reason: result.reason ?? 'unavailable' }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    videos: result.videos,
    shorts: result.shorts,
    continuation: result.continuation,
  });
}
