import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { persistence, resolveActiveModeId } from '@/lib/modes';
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

  // Scope the write to the active save-slot (explicit body.modeId → mode_id
  // cookie → visitor's Default).
  const modeId = await resolveActiveModeId(visitorId, slug, body.modeId);

  // `rationale` had no reader — it was written to the `preferences` row and
  // never queried back — so it is dropped rather than carried into the new
  // store. Re-add it to the Patch type if it ever needs surfacing.
  await persistence.write(visitorId, slug, modeId, [body.patch]);

  return NextResponse.json({ ok: true });
}
