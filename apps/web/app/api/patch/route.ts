import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveActiveModeId } from '@/lib/modes';
import type { Patch } from '@showcase/shared';

export const runtime = 'nodejs';

interface PatchBody {
  slug?: string;
  patch: Patch;
  rationale?: string;
  // Optional explicit save-slot; falls back to the active mode (cookie/Default).
  modeId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as PatchBody;
  if (!body.patch) {
    return NextResponse.json({ error: 'patch required' }, { status: 400 });
  }
  const slug = body.slug ?? 'streaming-platform';

  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  if (!visitorId) {
    return NextResponse.json({ error: 'no visitor_id cookie' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: site } = await db.from('sites').select('id').eq('slug', slug).single();
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  // mode_id is NOT NULL since migration 0002 — scope the write to the active
  // save-slot (explicit body.modeId → mode_id cookie → visitor's Default).
  const modeId = await resolveActiveModeId(visitorId, slug, body.modeId);

  await db.from('preferences').insert({
    visitor_id: visitorId,
    site_id: site.id,
    mode_id: modeId,
    patch: body.patch,
    rationale: body.rationale ?? null,
    message_id: null,
  });

  return NextResponse.json({ ok: true });
}
