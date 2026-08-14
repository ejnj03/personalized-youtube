import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { persistence } from '@/lib/modes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? 'streaming-platform';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30', 10) || 30, 100);

  const cookieStore = await cookies();
  const visitorId = cookieStore.get('visitor_id')?.value;
  if (!visitorId) return NextResponse.json({ messages: [] });

  // modeId required by the new SDK contract. If the chat panel didn't pass
  // one yet (during the transitional period), fall back to the visitor's
  // first/oldest mode for this slug — that's the row the migration created.
  let modeId = url.searchParams.get('modeId');
  if (!modeId) {
    const modes = await persistence.listModes(visitorId, slug);
    modeId = modes[0]?.id ?? null;
    if (!modeId) return NextResponse.json({ messages: [] });
  }

  const turns = await persistence.readTurns(visitorId, slug, modeId, limit);

  // Flatten turns into the message stream the chat panel renders.
  const messages: Array<{ role: 'user' | 'assistant'; content: string; toolUses?: Array<{ name: string }> }> = [];
  for (const t of turns) {
    // Skip empty user messages — these come from synthetic turns the server
    // records (e.g. resets) that have no visitor utterance. Rendering them
    // as a blank user bubble shows up as a wide accent-coloured strip.
    if (t.userMessage) messages.push({ role: 'user', content: t.userMessage });
    if (t.assistantMessage || t.toolUses.length > 0) {
      messages.push({
        role: 'assistant',
        content: t.assistantMessage,
        ...(t.toolUses.length > 0 ? { toolUses: t.toolUses } : {}),
      });
    }
  }

  return NextResponse.json({ messages });
}
