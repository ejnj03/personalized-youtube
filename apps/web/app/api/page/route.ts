import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRenderedConfig } from '@/lib/queries/page';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? 'streaming-platform';
  const modeId = url.searchParams.get('modeId');
  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;

  try {
    const config = await getRenderedConfig({ slug, visitorId, modeId });
    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
