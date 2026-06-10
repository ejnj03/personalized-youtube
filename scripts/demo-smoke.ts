/**
 * Dry-run smoke test: send each demo prompt through /api/chat and
 * assert that at least one valid tool_use fires per prompt. Run against
 * a running dev server (localhost:3000) with a fresh visitor cookie.
 *
 * Run: pnpm tsx scripts/demo-smoke.ts
 */

const BASE = process.env.SHOWCASE_BASE ?? 'http://localhost:3000';
const SLUG = 'streaming-platform';

const PROMPTS: Array<{ label: string; text: string; expectAtLeastOneOf: string[] }> = [
  {
    label: '2. aesthetics',
    text: 'Use a forest-green dark theme with bigger text.',
    expectAtLeastOneOf: ['update_theme'],
  },
  {
    label: '3. recommendations',
    text: 'Show me more chill jazz, less bangers.',
    expectAtLeastOneOf: ['set_filter', 'request_more_content'],
  },
  {
    label: '4. layout',
    text: 'Make thumbnails square and 4 columns.',
    expectAtLeastOneOf: ['update_theme', 'update_section'],
  },
  {
    label: '5. behavioral filter',
    text: 'Hide videos from any channel under 100k subs.',
    expectAtLeastOneOf: ['set_filter'],
  },
  {
    label: 'P1. hide shorts',
    text: 'Hide the shorts row.',
    expectAtLeastOneOf: ['remove_section', 'update_section'],
  },
  {
    label: 'P2. reorder',
    text: 'Move recommendations to the top.',
    expectAtLeastOneOf: ['reorder_sections'],
  },
  {
    label: 'P3. sort',
    text: 'Sort by most recent.',
    expectAtLeastOneOf: ['set_sort'],
  },
  {
    label: 'P4. compact',
    text: 'Compact mode.',
    expectAtLeastOneOf: ['update_section', 'update_theme'],
  },
];

async function getVisitorCookie(): Promise<string> {
  const res = await fetch(BASE);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = /visitor_id=([^;]+)/.exec(setCookie);
  if (!match) throw new Error(`No visitor_id cookie issued. Set-Cookie: ${setCookie}`);
  return match[1]!;
}

async function sendPrompt(cookie: string, text: string): Promise<{ tools: string[]; patches: number; ms: number; assistantText: string }> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `visitor_id=${cookie}` },
    body: JSON.stringify({ pageSlug: SLUG, message: text, history: [] }),
  });
  if (!res.body) throw new Error('No stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const tools: string[] = [];
  let patches = 0;
  let assistantText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') break;
      try {
        const ev = JSON.parse(data);
        if (ev.kind === 'text') assistantText += ev.text;
        if (ev.kind === 'tool_use') tools.push(ev.name);
        if (ev.kind === 'patch') patches++;
      } catch {
        /* ignore */
      }
    }
  }
  return { tools, patches, ms: Date.now() - t0, assistantText };
}

async function resetVisitor(cookie: string) {
  await fetch(`${BASE}/api/reset?slug=${SLUG}`, {
    method: 'POST',
    headers: { Cookie: `visitor_id=${cookie}` },
  });
}

async function main() {
  console.log(`Smoke testing ${BASE} ...`);
  const cookie = await getVisitorCookie();
  console.log(`Fresh visitor: ${cookie.slice(0, 8)}…`);
  await resetVisitor(cookie);

  let passed = 0;
  let failed = 0;
  for (const p of PROMPTS) {
    process.stdout.write(`  ${p.label.padEnd(28)} `);
    try {
      const result = await sendPrompt(cookie, p.text);
      const fired = new Set(result.tools);
      const hit = p.expectAtLeastOneOf.some((t) => fired.has(t));
      const status = hit ? 'PASS' : 'FAIL';
      const tools = result.tools.length > 0 ? result.tools.join(', ') : '(none)';
      console.log(
        `${status}  ${result.ms}ms  patches=${result.patches}  tools=[${tools}]  reply="${result.assistantText.slice(0, 50)}"`,
      );
      if (hit) passed++;
      else failed++;
    } catch (e) {
      console.log(`ERROR  ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${passed + failed} prompts hit expected tools.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
