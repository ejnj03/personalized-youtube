import { NextResponse } from 'next/server';
import { searchVideos } from '@/lib/innertube/client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length === 0 || q.length > 256) {
    return NextResponse.json({ ok: false, reason: 'invalid query' }, { status: 400 });
  }
  const result = await searchVideos(q);
  if (result.kind !== 'ok') {
    return NextResponse.json({ ok: false, reason: result.reason ?? 'unavailable' }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    videos: result.videos,
    shorts: result.shorts,
    // Pagination token so curated grids can infinite-scroll the same query.
    continuation: result.continuation,
    query: q,
  });
}
