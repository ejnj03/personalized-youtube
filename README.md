# Showcase — talk to your feed

**Personalize a streaming app by typing what you want. It restructures live, and it sticks.**

Open a pixel-faithful **YouTube** or **Spotify** clone — running on *your* real account — and just say it:

> *"green dark theme, hide shorts"*
> *"only academic videos from 9:00pm to 11:30pm"*
> *"first row Korean grammar lessons, the rest Korean variety shows"*
> *"swap out the recently played row for late-night lo-fi"*
> *"translate every song's lyrics to Korean"*

The page rewrites itself — themes, layouts, rows, filters, schedules — in a second, no settings menus. Preferences persist per **mode** (named save-slots you switch between), so your "Focus" feed and your "Party" feed are two clicks apart.

---

## What it actually is

A **chat-driven personalization engine** (`@showcase/sdk`) and two production-quality hosts built on it. You talk; Claude emits structured edits to a typed page-config; the page folds them in optimistically and saves them. No scripted commands — any prompt that fits the schema works.

The clones aren't mockups: the YouTube host reads your signed-in feed/library/playlists via `youtubei.js` (Chrome-cookie auth), and the Spotify host drives the real Spotify Web API under your token.

## What you can do

- **Restyle** — color tokens, fonts, card archetypes, grid/row layouts, ambient backgrounds, film grain. *"make it a cozy bookshop," "instagram-style square cards."*
- **Recompose** — add / remove / reorder rows; rename a row by clicking its title; swap out native rows.
- **Curate, on a schedule** — name a row and give it search rules (`queries` + `creators` + `tags`), optionally gated to a **minute-precise** local-time window. *"only classical piano, 8:00–10:30am."* The row fetches deterministically and flips on/off on its own — **zero LLM calls to re-apply.**
- **Pin** — hover any card's `@`, mention it in chat, and tell the agent to pin it to a row. It sticks until you remove it.
- **Modes** — parallel, named personalization sessions; each keeps its own config + chat history.
- **Real data, cached** — your home feed, subscriptions, library, playlists, comments — with a keyed TTL cache so repeat views are instant.

## How it works

```
You ──prompt──▶ ChatPanel ──▶ /api/chat ──▶ Claude (Opus) + tool defs
                                                    │ tool_use
                                                    ▼
                              typed Patch  ◀──  update_section / update_theme /
                                   │             add_section / request_more_content …
                                   ▼
         applyPatch(config, patch) ──▶ optimistic re-render ──▶ persist (Supabase, per-mode)
```

- **`packages/sdk`** — the host-agnostic core: the patch model, `defineHost`, Zod-derived tool schemas, the 4-segment **prompt cache** structure, `MediaCard` / `MediaFeed` / `useSourceRules`, tokens/fonts/card/layout presets, and the streaming chat handler. Server-safe `/core` + `/server` entries keep the client bundle out of RSC.
- **A host** (`apps/web` for YouTube, `spotify-react-web-client` for Spotify) supplies only what differs: its theme schema, section components, and a `provideContent` fetcher. Everything else — chat, modes, caching, curation, mentions — comes from the SDK.

One engine, two apps. Adding a third host is mostly a schema + a fetcher.

## Stack

Next.js 15 · React 19 · Tailwind · Zustand · Supabase · **Anthropic Claude** (`claude-opus`) · `youtubei.js` (real YouTube via Chrome cookies) · Spotify Web API · pnpm workspaces + Turbo · strict TypeScript end-to-end.

## Repo layout

```
showcase/
  packages/sdk/             # the personalization engine (core / client / server)
  packages/shared/          # YouTube host schemas (Zod single-source-of-truth)
  apps/web/                 # YouTube clone (Next.js)
  spotify-react-web-client/ # Spotify clone (CRA + Hono backend)
  supabase/migrations/      # append-only SQL (sites, visitors, preferences, modes, chat_turns)
```

## Run it

```bash
pnpm install
pnpm migrate            # apply DB schema (needs SUPABASE_ACCESS_TOKEN)
pnpm dev                # YouTube clone on :3000 (+ SDK watcher)
```

The YouTube host needs Chrome signed into YouTube (first run prompts macOS Keychain → *Always Allow*). The Spotify clone runs from `spotify-react-web-client/` with its own dev server + token.

---

*Built as a showcase of agent-driven UI: the LLM doesn't render the page — it edits a typed config the page already knows how to render. Fast, cheap (prompt-cached), and reversible (in-tab undo + per-mode history).*
