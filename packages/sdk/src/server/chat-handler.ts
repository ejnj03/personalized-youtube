// chat-handler.ts (outline)
import type { HostConfig } from '../core/contract';
import type { Patch, PageConfig } from '../core/patch';
import { applyPatches } from '../core/patch';

import { buildSystemBlocks, buildVisitorState } from '../core/prompts/system';
import { estimateCost } from '../core/anthropic';


// 1. Constants
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

interface ChatRequestBody {
  pageSlug: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Optional — hosts without cookie middleware (CRA, SPAs) pass it explicitly. */
  visitorId?: string;
  /** Required — identifies the active save-slot (mode) for read/write. */
  modeId: string;
}

function parseVisitorId(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/visitor_id=([^;]+)/);
  return match?.[1] ?? null;
}

/**
Example transformation

Input section:

{
  id: 'grid-1',
  type: 'VideoGrid',
  props: {
    columns: 4,
    density: 'cozy',
    videos: [{ id: 'v1', title: '...' },  ...59 more... ],
  },
}
Output summary:

{
  id: 'grid-1',
  type: 'VideoGrid',
  columns: 4,
  density: 'cozy',
  videos: '[60 videos]',
}
 */
function buildSectionSummary(
  sections: PageConfig['sections'],
): Array<Record<string, unknown>> {
  return sections.map((s) => {
    const props = s.props;
    const summary: Record<string, unknown> = { id: s.id, type: s.type };
    for (const [k, v] of Object.entries(props)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        // Collapse only HEAVY arrays of objects (videos[], tracks[]) to a count
        // marker. Small config arrays — curated `sources` rules, mood lists,
        // etc. — pass through in full so the LLM can read AND edit them. The
        // serialized-size gate keeps this host-agnostic (no key denylist).
        const json = JSON.stringify(v);
        summary[k] = json.length <= 800 ? v : `[${v.length} ${k}]`;
      } else if (typeof v === 'object' && v !== null) {
        // Truncate nested objects to 120 chars
        summary[k] = JSON.stringify(v).slice(0, 120);
      } else {
        // Primitives (strings, numbers, booleans) pass through as-is
        summary[k] = v;
      }
    }
    return summary;
  });
}

/**
 * Convert one Anthropic tool_use block into a Patch the store can apply.
 *
 * Claude calls one of 9 tools per turn. They split into two categories:
 *
 *   PAGE-EDIT TOOLS (7) → return a Patch
 *   SIDE-EFFECT TOOLS (2) → return null (factory forwards as separate SSE events)
 *
 * ─── Examples ───
 *
 * 1. update_section
 *    in:  { name: 'update_section',
 *           input: { sectionId: 'grid-1', patch: { columns: 3, density: 'compact' } } }
 *    out: { op: 'update_section',
 *           sectionId: 'grid-1', patch: { columns: 3, density: 'compact' } }
 *
 * 2. update_theme (top-level shape — the intended form)
 *    in:  { name: 'update_theme', input: { mode: 'dark', accent: '#A78BFA' } }
 *    out: { op: 'update_theme', patch: { mode: 'dark', accent: '#A78BFA' } }
 *
 *    update_theme (defensive un-wrap — Claude sometimes does this)
 *    in:  { name: 'update_theme', input: { patch: { mode: 'dark' } } }
 *    out: { op: 'update_theme', patch: { mode: 'dark' } }   ← unwrapped
 *
 * 3. set_filter
 *    in:  { name: 'set_filter', input: { requireTags: ['jazz'], excludeTags: ['hype'] } }
 *    out: { op: 'set_filter', filter: { requireTags: ['jazz'], excludeTags: ['hype'] } }
 *
 * 4. set_sort
 *    in:  { name: 'set_sort', input: { by: 'recent', order: 'desc' } }
 *    out: { op: 'set_sort', sort: { by: 'recent', order: 'desc' } }
 *
 * 5. add_section
 *    in:  { name: 'add_section',
 *           input: { type: 'MoodBoard', props: { mood: 'focus' }, position: { after: 'grid-1' } } }
 *    out: { op: 'add_section',
 *           sectionType: 'MoodBoard', props: { mood: 'focus' }, position: { after: 'grid-1' } }
 *
 * 6. remove_section
 *    in:  { name: 'remove_section', input: { sectionId: 'shorts-1' } }
 *    out: { op: 'remove_section', sectionId: 'shorts-1' }
 *
 * 7. reorder_sections
 *    in:  { name: 'reorder_sections',
 *           input: { order: ['top-bar-1', 'grid-1', 'shorts-1'] } }
 *    out: { op: 'reorder_sections',
 *           order: ['top-bar-1', 'grid-1', 'shorts-1'] }
 *
 * 8. request_more_content (side-effect — returns null)
 *    in:  { name: 'request_more_content',
 *           input: { category: 'jazz', count: 8, style: 'chill' } }
 *    out: null   ← factory body sends { kind: 'request_more_content', input } over SSE
 *
 * 9. ask_user (side-effect — returns null)
 *    in:  { name: 'ask_user',
 *           input: { question: 'Hide the shorts row?', options: ['Yes', 'No'] } }
 *    out: null   ← factory body sends { kind: 'ask_user', input } over SSE
 *
 * Unknown tool names return null. The default case is defensive against
 * future schema drift — if the SDK adds a tool but this switch isn't updated,
 * tool calls produce nothing rather than a malformed Patch.
 *
 * ─── Defensive defaults ───
 *   - Missing `patch`     → empty object (no-op)
 *   - Missing `position`  → { index: -1 } (append at end)
 *   - Missing `order`     → empty array
 */
function toolUseToPatch(tu: { name: string; input: any }): Patch | null {
  switch (tu.name) {
    case 'update_section':
      return {
        op: 'update_section',
        sectionId: tu.input.sectionId,
        patch: tu.input.patch ?? {},
      };
    case 'update_theme': {
      // Defensive un-wrap: Claude sometimes wraps theme fields in a {patch: ...}
      // object mirroring update_section's shape. Treat both forms as the same.
      const raw = tu.input as Record<string, unknown>;
      const isWrapped =
        raw &&
        typeof raw === 'object' &&
        Object.keys(raw).length === 1 &&
        'patch' in raw &&
        typeof raw.patch === 'object' &&
        raw.patch !== null;
      return { op: 'update_theme', patch: (isWrapped ? raw.patch : raw) as any };
    }
    case 'set_filter':
      return { op: 'set_filter', filter: tu.input };
    case 'set_sort':
      return { op: 'set_sort', sort: tu.input };
    case 'add_section':
      return {
        op: 'add_section',
        sectionType: tu.input.type,
        props: tu.input.props ?? {},
        position: tu.input.position ?? { index: -1 },
      };
    case 'remove_section':
      return { op: 'remove_section', sectionId: tu.input.sectionId };
    case 'reorder_sections':
      return { op: 'reorder_sections', order: tu.input.order ?? [] };
    case 'request_more_content':
    case 'ask_user':
      return null;
    default:
      return null;
  }
}

// 3. Main factory
export function createChatHandler(
  host: HostConfig,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // ─── 1. Parse request body ───
    let body: ChatRequestBody;
    try {
      body = (await req.json()) as ChatRequestBody;
    } catch {
      return new Response(JSON.stringify({ error: 'invalid JSON' }), {
        status: 400,
      });
    }
    const { pageSlug, message, history = [], visitorId: bodyVisitorId, modeId } = body;

    // ─── 2. Extract visitor id ───
    // Prefer the cookie (set by host middleware) but fall back to the body
    // (CRA/SPA hosts manage the id in localStorage and send it explicitly).
    const visitorId = parseVisitorId(req) ?? bodyVisitorId ?? null;
    if (!visitorId) {
      return new Response(JSON.stringify({ error: 'no visitor id (provide via cookie or body.visitorId)' }), {
        status: 400,
      });
    }
    if (!modeId) {
      return new Response(JSON.stringify({ error: 'no modeId (each turn must specify a save-slot)' }), {
        status: 400,
      });
    }

    // ─── 3. Load current config from persistence ───
    let config: PageConfig;
    try {
      const patches = await host.persistence.read(visitorId, pageSlug, modeId);
      config = applyPatches(host.initialConfig, patches);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'persistence read failed',
          message: (err as Error).message,
        }),
        { status: 500 },
      );
    }

    // ─── 4. Assemble the prompt ───

    // Section summary — drop heavy fields like videos[] so Claude only sees
    // ids and types, not the catalog inline. Cuts tokens dramatically.
    const sectionSummaries = buildSectionSummary(config.sections);

    // The per-visitor state segment (not cacheable across visitors).
    const visitorState = buildVisitorState(
      {
        sections: sectionSummaries,
        theme: config.theme,
        filter: config.filter,
        sort: config.sort,
      },
      [], // recent patches summary — empty for v0; future enhancement
    );

    // The 3 cacheable system blocks. host.rolePrompt / schemaCatalogPrompt /
    // editingRulesPrompt were prebuilt at defineHost() time (Stage 3d). We
    // just wrap them in Anthropic's cache_control format.
    const toolsSummary = JSON.stringify(
      host.toolDefinitions.map((t) => ({ name: t.name, description: t.description })),
      null,
      2,
    );

    const sys = {
      role: {
        type: 'text' as const,
        text: host.rolePrompt + '\n\n## Tools available\n' + toolsSummary,
        cache_control: { type: 'ephemeral' as const },
      },
      schemaCatalog: {
        type: 'text' as const,
        text: host.schemaCatalogPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
      editingRules: {
        type: 'text' as const,
        text: host.editingRulesPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    };

    // The user message — visitor state + their actual prompt.
    const userBlocks = [
      { type: 'text' as const, text: visitorState },
      { type: 'text' as const, text: '\n\nVisitor: ' + message },
    ];

    // Full messages array — prior turns + the new user message.
    const messages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: userBlocks },
    ];

    // ─── 5. Open SSE stream and run the turn ───
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (obj: unknown) =>
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

        // Per-turn state — accumulated as Claude streams back.
        const t0 = Date.now();
        const toolUses: Array<{ name: string; input: unknown }> = [];
        const patchesToWrite: Patch[] = [];
        let assistantText = '';
        let finalUsage: any = {};
        let stopReason: string | null = null;
        let lastMessageId: string | undefined;

        // The full request payload — also echoed to client for debugging.
        const requestPayload = {
          model: host.model,
          max_tokens: 1024,
          system: [sys.role, sys.schemaCatalog, sys.editingRules],
          tools: host.toolDefinitions,
          messages,
        };
        send({ kind: 'debug_request', payload: requestPayload });

        try {
          // Open Claude's stream — returns an async iterable of events.
          const response = host.getClient().messages.stream(requestPayload as any);

          // Forward events as they arrive. Three event types we care about:
          //   message_start         → capture message id for correlation
          //   content_block_start   → if a tool_use opens, tell client (pill)
          //   content_block_delta   → if it's text, stream the chunk to client
          //   message_delta         → accumulate usage stats + stop_reason
          for await (const ev of response) {
            send({ kind: 'debug_stream_event', payload: ev });

            if (ev.type === 'message_start') {
              lastMessageId = ev.message.id;
            }
            if (
              ev.type === 'content_block_start' &&
              ev.content_block.type === 'tool_use'
            ) {
              send({ kind: 'tool_use', name: ev.content_block.name });
            }
            if (
              ev.type === 'content_block_delta' &&
              ev.delta.type === 'text_delta'
            ) {
              send({ kind: 'text', text: ev.delta.text });
            }
            if (ev.type === 'message_delta') {
              stopReason = ev.delta.stop_reason ?? null;
              finalUsage = { ...finalUsage, ...ev.usage };
            }
          }

          // Get the assembled final message for tool_use processing.
          const finalMessage = await response.finalMessage();
          finalUsage = finalMessage.usage;
          send({
            kind: 'debug_final',
            payload: {
              content: finalMessage.content,
              usage: finalUsage,
              stop_reason: stopReason,
            },
          });
          // Walk the final message content for tool_use blocks.
          for (const block of finalMessage.content) {
            if (block.type === 'text') {
              assistantText += block.text;
              continue;
            }
            if (block.type !== 'tool_use') continue;

            const tu = block as { name: string; input: any; id: string };
            toolUses.push({ name: tu.name, input: tu.input });

            const patch = toolUseToPatch(tu);
            if (patch) {
              // Page-edit tool → queue for persistence and stream to client.
              patchesToWrite.push(patch);
              send({ kind: 'patch', patch });
            } else if (tu.name === 'request_more_content') {
              // Side-effect tool → forward to client; host handles fetching.
              send({ kind: 'request_more_content', input: tu.input });
            } else if (tu.name === 'ask_user') {
              // Side-effect tool → forward; client renders the question.
              send({ kind: 'ask_user', input: tu.input });
            }
          }
        } catch (err) {
          // Inside catch: tell the client the turn errored. The cleanup below
          // (cost / persist / log / close) still runs so the connection terminates
          // cleanly.
          send({ kind: 'error', message: (err as Error).message });
        }

        // ─── 6. Compute cost + cache stats ───
        const cacheRead = finalUsage.cache_read_input_tokens ?? 0;
        const cacheCreate = finalUsage.cache_creation_input_tokens ?? 0;
        const inputT = (finalUsage.input_tokens ?? 0) + cacheRead + cacheCreate;
        const cacheHitRatio = inputT > 0 ? cacheRead / inputT : 0;
        const cost = estimateCost(host.model, finalUsage);

        // ─── 7. Persist new patches ───
        if (patchesToWrite.length > 0) {
          try {
            await host.persistence.write(visitorId, pageSlug, modeId, patchesToWrite);
          } catch {
            // best-effort: don't fail the turn if persistence write errors
          }
        }

        // ─── 7b. Record chat turn ───
        // Persists the user/assistant pair so the chat panel can rehydrate
        // on next page load. Best-effort — failures don't break the turn.
        try {
          await host.persistence.recordTurn(visitorId, pageSlug, modeId, {
            userMessage: message,
            assistantMessage: assistantText,
            toolUses: toolUses.map((t) => ({ name: t.name })),
            createdAt: new Date().toISOString(),
          });
        } catch {
          // best-effort
        }

        // ─── 8. Log the turn ───
        try {
          await host.logger.log({
            ts: new Date().toISOString(),
            sessionId: lastMessageId,
            visitorId,
            durationMs: Date.now() - t0,
            inputTokens: finalUsage.input_tokens ?? 0,
            outputTokens: finalUsage.output_tokens ?? 0,
            cacheReadTokens: cacheRead,
            cacheCreationTokens: cacheCreate,
            cacheHitRatio,
            costUsd: cost,
            model: host.model,
            toolUses,
            stopReason,
          });
        } catch {
          // best-effort: logging never breaks a turn
        }

        // ─── 9. Close the stream ───
        send({ kind: 'done', cacheHitRatio, costUsd: cost });
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  };
}