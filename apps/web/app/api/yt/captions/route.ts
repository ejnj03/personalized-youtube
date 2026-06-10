import { NextResponse } from 'next/server';
import { getCaptions } from '@/lib/innertube/client';

export const runtime = 'nodejs';

// GET /api/yt/captions?v=<videoId>&langs=en,ko
// Returns index-aligned caption tracks for the requested languages: the
// native transcript anchor for its own language, cached translations for the
// rest. Tracks come back in the requested order.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const v = (url.searchParams.get('v') ?? '').trim();
  if (v.length === 0 || v.length > 20) {
    return NextResponse.json({ ok: false, reason: 'invalid video id' }, { status: 400 });
  }
  const langs = (url.searchParams.get('langs') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3); // cap stacked languages
  if (langs.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no langs requested' }, { status: 400 });
  }

  const result = await getCaptions(v, langs, process.env.ANTHROPIC_API_KEY ?? '');
  if (result.kind !== 'ok') {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ ok: true, tracks: result.tracks, anchorLang: result.anchorLang });
}
