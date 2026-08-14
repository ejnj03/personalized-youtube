# CLAUDE.md — Orchestrator Brief

This file is loaded into every Claude Code session for this repo. It's the **orchestrator's brief** — the high-level map of the project, the conventions, and the agent ownership table. Implementation details live in the per-domain code; nuanced decisions live in `docs/decisions.md`.

## What this project is

A **chat-driven personalization engine** (`@showcase/sdk`) plus two hosts built on it: a YouTube clone (`apps/web`) and a Spotify clone (`spotify-react-web-client`). Visitors type any prompt and the page restructures live; preferences stick per visitor cookie and per **mode** (named save-slots).

Both hosts run on **real accounts**, not fixtures: YouTube via `youtubei.js` reading Chrome cookies, Spotify via the Web API. The mock catalog and its Haiku generator were removed — there is no fabricated data to fall back to.

Persistence is a **local SQLite file** (`@showcase/sdk/sqlite`); there is no database to provision and no seed step. `supabasePersistence` remains in the SDK as the hosted option.

## Stack

- Next.js 15 (App Router) + React 19 + Tailwind 3.4
- Zustand + zundo (in-tab undo)
- SQLite via `better-sqlite3` (cookie-anonymous, no auth). **Node 20 only** — native ABI, see `.nvmrc`.
- Anthropic SDK (`@anthropic-ai/sdk`) with `claude-opus-4-7` for chat
- pnpm workspaces: `packages/sdk` (the product) + `packages/shared`, and two hosts. The earlier `apps/desktop` Electron sidecar has been removed; real YouTube data flows through `apps/web/lib/innertube/` reading Chrome cookies directly.

## Repo layout (root = this directory)

```
showcase/
  packages/sdk/                   # THE PRODUCT: patch model, defineHost, chat handler,
                                  # persistence adapters, presets. Has its own docs/.
  packages/shared/                # Zod schemas, tool defs, PageConfig types (YouTube host)
  apps/web/                       # YouTube clone (Next.js 15)
  spotify-react-web-client/       # Spotify clone (CRA client + Hono server)
  .claude/agents/                 # specialist subagents — STALE, predate the SDK split
  supabase/migrations/            # SQL for the optional hosted adapter; not used locally
  docs/                           # ONBOARDING, architecture, GLOSSARY, decisions, youtube-adapter
  logs/                           # JSONL Anthropic call logs (gitignored)
```

## How to use this repo (the delegation pipeline)

**The main Claude Code session is an orchestrator, not an implementer.** When you (the user, or a future Claude session) ask for a change:

1. Identify the affected domain (schemas, templates, chat/API, persistence, real data, debugging).
2. Delegate to the matching specialist subagent in `.claude/agents/`.
3. Each subagent runs in its own context window and returns a 3-line summary.
4. The main session never accumulates implementation details — only the high-level state.

### Agent ownership table

Seven agents. Two were deleted rather than updated — see the note below.

| Agent | Owns | Trigger |
|---|---|---|
| `schema-keeper` | `packages/shared/src/{schemas,page-config,tool-schemas}` | Add/modify section type or prop, change tool surface |
| `template-author` | `apps/web/components/templates/*` | Add/modify React section components |
| `api-keeper` | `app/api/chat/`, `lib/prompts/`, `lib/anthropic.ts`, and the SDK's `chat-handler.ts` + `tool-defs.ts` | Modify chat tools, prompts, streaming, caching |
| `persistence-keeper` | `PersistenceAdapter` + its 5 implementations, `lib/modes.ts`, `lib/queries/` | Where visitor state lives; modes; new storage backends |
| `youtube-adapter` | `apps/web/lib/innertube/`, `lib/adapters/`, `app/api/yt/` | Real YouTube data via Chrome cookies + youtubei.js |
| `debugger` | `logs/`, `.showcase/*.db` (read-only on everything else) | Investigate breakage, produce a root cause with evidence |
| `cache-doctor` | (read-only) | Audit cache hit ratio after prompt/schema changes |

**Deleted:** `feed-curator` owned the mock catalog, `scripts/seed.ts`, and
`lib/adapters/mock.ts` — all removed, so it owned nothing. `research-runner` was
a one-shot Day-1 pass whose only output (`docs/research.md`) no longer exists.
`db-keeper` became `persistence-keeper`: it held Supabase MCP tools pointed at a
deleted project and owned a `lib/supabase.ts` that is gone.

### Skills layered on top

- `claude-api` — invoked when api-keeper writes prompt code; enforces caching from line 1.
- `frontend-design` — invoked when template-author needs a polish pass.
- `simplify` — at end of each milestone.
- `organize` — weekly.
- `init` — to refresh this file.

## Conventions

- **Strict TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`. Tests catch this; CI gates on `pnpm typecheck`.
- **Tailwind only** for styling. CSS variables on a wrapper for theming (`--accent`, `--font-scale`).
- **Zod schemas are the single source of truth** — React props, tool inputs, and validators all derive from them.
- **Stable section IDs** survive across patches. Never regenerate them.
- **Append-only migrations**. Never edit a merged SQL file.
- **No comments unless they explain a non-obvious WHY.**
- **Env**: `.env.example` committed; `.env.local` gitignored. Per-developer Anthropic key.

## Cache breakpoint structure (4 segments)

In every chat call, in this order:
1. System role + tool definitions (cacheable, stable)
2. Section schema catalog + tag vocabulary (cacheable, semi-stable)
3. Editing rules + few-shot examples (cacheable, rarely changes)
4. Per-visitor state — current page snapshot + recent preference summary (NOT cacheable across visitors)

Anything appended *before* breakpoint 4 busts the cache for all visitors. After any prompt change, run `cache-doctor`.

## Where decisions live

- `docs/architecture.md` — data flow, patch folding, cache structure. Updated on architectural change.
- `docs/decisions.md` — append-only log: "Decided X because Y on date Z." Every domain agent appends here.
- `docs/ONBOARDING.md` — first-30-minutes guide for new contributors.
- `docs/GLOSSARY.md` — term definitions for non-systems-architecture readers.
- `docs/youtube-adapter.md` — real-YouTube-data path: Chrome cookies + youtubei.js + breakage modes.

## Quick references

- Full plan: `/Users/ejun22/.claude/plans/yes-absolutely-and-sleepy-dewdrop.md`
- Recommended prompts (chip pool): `apps/web/lib/recommended-prompts.ts`
- Demo script: section 13 of the plan file.
