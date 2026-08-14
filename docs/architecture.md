# How this app works

> **New here? Read [ONBOARDING.md](./ONBOARDING.md) first.** That doc gets you running in 30 minutes and shipping a tiny change. *This* doc is the deep dive — useful once you have the app running and want to understand *how* it does what it does.
>
> **Don't know a term?** Open [GLOSSARY.md](./GLOSSARY.md) in another tab. Every technical term in here is defined there in one or two sentences.
>
> **Skim, don't grind.** This is ~25 minutes at a careful pace. Most readers only need the "big idea", "agent flow", and "four layers" sections. The rest is reference material — return to it when a specific question comes up.

---

This is an explainer tailored for those who are unfamiliar with building web applications. We'll start with what the user sees, then peel back each layer until we hit the AI part — the most interesting bit. By the end you'll understand how a single sentence typed into chat ("make it feel like a quiet bookshop") becomes a fully restyled page.

If you want to read the code instead, the file paths in `[brackets]` point you to the right place.

---

## What the app actually is

It looks like YouTube. There's a top bar with a search box, a sidebar of nav links, a grid of video thumbnails, a "shorts" row, and so on. **But** there's a small chat panel in the corner that you can drag around. You type things into it like:

- "use a green dark theme"
- "show me only podcasts"
- "make the page breathe with what I'm watching"

…and the YouTube-shaped page rearranges itself in front of you. Refresh the page — your changes are still there.

That's the whole product in one paragraph. Everything below is *how* that works.

---

## The big idea: a page is just a description

Think of a webpage as a recipe instead of a finished cake. Our recipe has these ingredients:

- A list of **sections** (the top bar, the sidebar, a grid of videos, a row of shorts, etc.)
- A **theme** (colors, fonts, corner roundness, how saturated thumbnails look)
- A **filter** (which videos to show — by tag, channel, length, watch-history)
- A **sort** (what order to show them in)

We bundle all of that into one big object called a `PageConfig`. It's a plain piece of JSON-shaped data. When the page renders, we walk that config and turn it into HTML.

> 📁 The shape lives in [`packages/shared/src/page-config.ts`](../packages/shared/src/page-config.ts) and [`packages/shared/src/schemas/`](../packages/shared/src/schemas/).
> The bit that turns config → HTML is [`apps/web/components/site/Site.tsx`](../apps/web/components/site/Site.tsx) and the section components in [`apps/web/components/templates/`](../apps/web/components/templates/).

So if we can change the `PageConfig`, we can change anything visible. The whole personalization story reduces to: **how do we let the user change the PageConfig by talking?**

---

## The agent flow, in one picture

Here's what happens when you type "use a green dark theme" and hit send:

```
                                                         ┌──────────────────┐
  visitor types                  ─────────────────►      │   Claude (LLM)   │
  "use a green dark theme"                               │                  │
                                                         │ reads the page   │
                                                         │ state + the      │
                                                         │ message and      │
                                                         │ emits TOOL CALLS │
                                                         └────────┬─────────┘
                                                                  │
                       ┌──────────────────────────────────────────┘
                       ▼
              one or more "patches"
              (small JSON edits to PageConfig):
              { op: 'update_theme',
                patch: { mode: 'dark', accent: '#22C55E' } }
                       │
                       │ stream back to the browser
                       ▼
              the browser applies the patch to its in-memory PageConfig
              the React tree re-renders                    ── you see green
                       │
                       │ (also fire-and-forget)
                       ▼
              save the patch to the database, keyed by your visitor cookie
                       │
                       │ next time you reload:
                       ▼
              read all your patches, replay them onto the base config,
              render that.                                ── still green, days later
```

Each box is one of the moving parts we'll explain below.

---

## The four layers (top to bottom)

### 1. **The page** — what you see

A standard React + Tailwind app, rendered by [Next.js](https://nextjs.org). The route `/` reads the visitor's cookie, looks up the saved `PageConfig` for that cookie, and renders it as HTML. The page mounts a chat panel on top.

> 📁 [`apps/web/app/page.tsx`](../apps/web/app/page.tsx) — the entry point.
> [`apps/web/components/site/Site.tsx`](../apps/web/components/site/Site.tsx) — walks the sections list and renders each one.
> [`apps/web/components/site/PageRoot.tsx`](../apps/web/components/site/PageRoot.tsx) — applies global theme stuff (background, grain, ambient overlays).

### 2. **The store** — the page's live mind

The `PageConfig` is held in a small in-memory store that React components read from. When a patch comes in (from chat OR from a chip click OR from a search), we apply it to the store and React re-renders the affected pieces.

> 📁 [`apps/web/lib/store.tsx`](../apps/web/lib/store.tsx) — `PageStoreProvider` and `usePageStore()`.
> The store carries the config + a few pieces of UI state (which video is being watched, the YouTube continuation token for infinite scroll, etc.).

### 3. **The patch system** — small, safe, undoable edits

Instead of replacing the whole config every time, we apply tiny patches. There are seven kinds:

| Patch | Example | What it does |
|---|---|---|
| `update_theme` | `{ accent: '#22C55E' }` | merges into `theme` |
| `update_section` | `{ sectionId: 'videoGrid', patch: { density: 'compact' } }` | merges into one section's props |
| `add_section` | `{ sectionType: 'MoodBoard', position: { after: 'categoryChips' } }` | inserts a new section |
| `remove_section` | `{ sectionId: 'shortsRow' }` | drops a section |
| `reorder_sections` | `{ order: ['topBar', 'recommendedRow', 'videoGrid'] }` | reshuffles |
| `request_more_content` | `{ category: 'jazz', count: 8 }` | side effect: asks the host to fetch |
| `ask_user` | `{ question: '…' }` | side effect: asks a clarifying question |

> `set_filter` and `set_sort` used to be separate patch kinds. They are gone —
> filter and sort are `PageConfig` fields edited through `update_section`.

Each patch is validated against a schema (using a library called [Zod](https://zod.dev)) before we apply it. So the LLM can't accidentally write nonsense like `mode: 'spaghetti'` — it gets rejected.

> 📁 [`packages/shared/src/page-config.ts`](../packages/shared/src/page-config.ts) — the `applyPatch` reducer.
> Patches arrive from chat as `tool_use` blocks, get converted into our patch shape, and dispatched into the store.

### 4. **Persistence** — your changes stick

Each patch is also saved to a local SQLite file, keyed by your `visitor_id` cookie **and** the active mode. When you reload the page, we replay every patch you've made in that mode on top of the base config. That's why the page remembers you.

The baseline config is not stored — it lives in code, so rendering the default page needs no backend at all.

> 📁 [`apps/web/lib/queries/page.ts`](../apps/web/lib/queries/page.ts) — `getRenderedPage()` does the read + replay.
> [`apps/web/lib/base-config.ts`](../apps/web/lib/base-config.ts) — the baseline, in code.
> [`apps/web/lib/modes.ts`](../apps/web/lib/modes.ts) — the single persistence swap point.
> [`packages/sdk/src/server/persistence/sqlite.ts`](../packages/sdk/src/server/persistence/sqlite.ts) — the adapter.

---

## How a chat message turns into changes

This is the magic part. The visitor types text. Claude (a large language model from Anthropic) reads it and emits patches. Step by step:

### Step 1 — Send the message

When you submit chat input, the browser fires a request to `/api/chat` with the message text + recent history + (if you're on the watch view) the currently-playing video info.

> 📁 [`apps/web/components/chat/ChatPanel.tsx`](../apps/web/components/chat/ChatPanel.tsx)

### Step 2 — Build the prompt

`/api/chat` doesn't just forward your message. It assembles a thoughtful prompt for Claude with:

1. **A role** — *"You're an editor for a personalizable YouTube clone. Compose tool calls."*
2. **A schema catalog** — every section type, every theme field, every filter/sort option. So the LLM knows what it can change.
3. **Editing rules + few-shot examples** — *"When the visitor says 'lo-fi', emit `update_theme` with these specific colors."* About 30 worked examples covering composition patterns.
4. **The current state** — a compact summary of the visitor's current page config (no heavy fields like the full video list — just ids and types).
5. **Your message.**

The first three pieces almost never change between requests, so we mark them as **cacheable**. Anthropic's prompt-caching means we only pay full cost on the first request; later ones reuse the cached prefix at ~10% cost. Net effect: each chat round is cheap and fast.

> 📁 [`apps/web/lib/prompts/`](../apps/web/lib/prompts/) — host-specific fragments.
> [`packages/sdk/src/core/prompts/`](../packages/sdk/src/core/prompts/) — the shared assembly and editing rules.
> [`packages/sdk/src/server/chat-handler.ts`](../packages/sdk/src/server/chat-handler.ts) — assembles + sends. The host route is a thin mount over it.

### Step 3 — Claude responds with tool calls

Claude doesn't reply with prose like *"Sure, I'll change the theme."* Instead it emits structured **tool use** blocks — think of them as function calls. For your message *"use a green dark theme"*, it might emit:

```json
{ "name": "update_theme", "input": { "mode": "dark", "accent": "#22C55E" } }
```

For *"make it feel like a quiet bookshop"* it might emit a chain:

```json
{ "name": "update_theme", "input": { "mode": "light", "fontFamily": "serif",
  "background": { "kind": "paper", "from": "#f3eee0" },
  "cardPreset": "editorial" } }
{ "name": "update_section", "input": { "sectionId": "videoGrid",
  "patch": { "layout": "shelves", "columns": 2 } } }
{ "name": "update_section", "input": { "sectionId": "categoryChips",
  "patch": { "visible": false } } }
```

There are **seven** tools: `update_section`, `update_theme`, `add_section`,
`remove_section`, `reorder_sections`, `request_more_content`, `ask_user`.

> 📁 [`packages/sdk/src/core/tool-defs.ts`](../packages/sdk/src/core/tool-defs.ts) — the tool definitions, host-agnostic.
> [`packages/sdk/src/core/prompts/editing-rules.ts`](../packages/sdk/src/core/prompts/editing-rules.ts) — examples of the LLM picking which tools to use.

### Step 4 — Stream the patches back

We don't wait for Claude to finish thinking. Each tool call streams back to the browser as it lands, via Server-Sent Events. The chat UI shows a live "Thinking…" indicator and pills like "tweaked the look" as each one arrives.

> 📁 [`packages/sdk/src/server/chat-handler.ts`](../packages/sdk/src/server/chat-handler.ts) — the SSE side.

### Step 5 — Apply each patch

When the browser receives a patch event, it dispatches it into the store. The store reduces the patch onto the current config (`applyPatch`), and React re-renders. Anything that depends on the changed field updates instantly.

> 📁 [`apps/web/lib/store.tsx`](../apps/web/lib/store.tsx) — `dispatch` is the entry point.

### Step 6 — Persist + remember

In parallel with the visual update, the patch is written through the persistence adapter. When you reload, [`getRenderedPage`](../apps/web/lib/queries/page.ts) replays your patches onto the base config in order.

---

## Composition: how arbitrary prompts become coherent

The clever part of this design isn't any single primitive — it's that the LLM **composes** them.

Look at the difference between asking for "lo-fi" vs "cyberpunk" vs "Berlin techno club":

- **lo-fi** → indigo→violet gradient bg, soft purple accent, rounded font, lg radius
- **cyberpunk** → near-black → magenta gradient, cyan accent, mono font, sm radius
- **Berlin techno club** → black→slate gradient, hot-pink accent, mono font, sharp radius (no rounding)

We didn't write code for each of these vibes. The few-shot examples teach Claude the *pattern* (vibe → mode + accent + fontFamily + radius + background), and Claude generalizes. **You can type any vibe word and get a coherent set of changes.**

The same pattern shows up everywhere:

- Typing a behavioral preference → composes `update_section` on the filter/sort fields, plus maybe an `add_section`
- Typing an aesthetic vibe → composes `update_theme` (multiple fields at once)
- Typing a feed reorganization → composes `remove_section` + `add_section` + `update_section`
- Typing "match the page to the playing video" → Claude looks at the thumbnail (we send it as a multimodal image) and picks the whole vibe from the colors / mood

---

## The video source

There is exactly one: real YouTube.

> **Removed.** A 168-video mock catalog, generated once via Claude Haiku and
> stored in Supabase, used to be the default, with real YouTube as opt-in. Both
> the catalog and its seed script are gone. Nothing fabricates videos now — when
> the real path fails, `getAdapter()` returns an **empty** feed and warns. A
> reader looking for `lib/adapters/mock.ts` or `scripts/seed.ts` will not find
> them.

### Real YouTube

The trick: most users on most machines run a Chrome browser. Chrome stores YouTube cookies on disk. **We read those cookies directly** (with macOS keychain permission) and use them to call YouTube's internal `youtubei` API as if we were that browser.

The result: the homepage shows your *actual* feed — your subscriptions, your real chip rail (which is personalized to your watch history), your search results. There is no env var to set; it is the only source. (`SHOWCASE_FEED_SOURCE` appeared in older docs and is read by nothing.)

The same chat-driven personalization wraps both sources, because the chat layer only edits the `PageConfig`, not the videos themselves.

> 📁 [`apps/web/lib/innertube/`](../apps/web/lib/innertube/) — the youtubei.js wrapper + Chrome cookie reader.
> [`apps/web/lib/adapters/`](../apps/web/lib/adapters/) — forwards the youtube adapter's `'ok'` results and returns an empty feed otherwise.

---

## What lives where (a tour)

```
packages/sdk/                      THE PRODUCT. Host-agnostic engine.
├── src/
│   ├── core/                      Server-safe, no 'use client'.
│   │   ├── contract.ts            defineHost + the PersistenceAdapter interface.
│   │   ├── patch.ts               The patch model and applyPatches.
│   │   ├── tool-defs.ts           The 7 Anthropic tool definitions.
│   │   ├── prompts/               Shared prompt assembly + editing rules.
│   │   ├── cards/ layouts/        Preset catalogs a host can offer.
│   │   ├── tokens.ts fonts/       Theme token + font presets.
│   │   └── captions/              Subtitle fetch + Haiku translation.
│   ├── server/                    Node-only.
│   │   ├── chat-handler.ts        The streaming chat loop. The real engine.
│   │   └── persistence/sqlite.ts  Local-file adapter (both hosts use this).
│   └── client/                    Browser.
│       ├── persistence/           in-memory, localStorage, cookie, supabase.
│       └── (chat panel, MediaCard, MediaCollection, hooks)

apps/web/                          YouTube host (Next.js 15).
├── app/
│   ├── page.tsx                   Server component. Reads the visitor cookie,
│   │                              renders the shell.
│   └── api/
│       ├── chat/route.ts          Thin mount over the SDK's createNextHandler.
│       ├── chat/history/          GET historical chat turns.
│       ├── page/route.ts          GET the current rendered config.
│       ├── patch/route.ts         POST a patch (chat + chip clicks).
│       ├── reset/route.ts         DELETE preferences for a visitor+mode.
│       ├── modes/route.ts         List / create save-slots.
│       └── yt/                    YouTube proxy: /info, /more, /comments.
├── components/
│   ├── chat/                      Chat panel wiring.
│   ├── site/                      Page shell.
│   └── templates/                 One file per section type + registry.tsx.
└── lib/
    ├── store.tsx                  React Context store of the live PageConfig.
    ├── base-config.ts             The baseline PageConfig, in code.
    ├── modes.ts                   Persistence + active-mode resolution.
    ├── adapters/                  youtube + selector.
    ├── innertube/                 Chrome cookie reader, youtubei.js client,
    │                              and the JSON walker.
    ├── prompts/                   Host-specific prompt fragments.
    ├── queries/page.ts            SSR read: base config + replay patches.
    └── anthropic.ts               Host client + cost estimation + JSONL log.

spotify-react-web-client/          Spotify host (CRA client + Hono server).
├── src/personalization/host.ts    Its defineHost call.
└── server/                        Hono API on :8787, authoritative for state.

packages/shared/                   YouTube-host schemas.
├── src/page-config.ts             PageConfig schema + applyPatch reducer.
├── src/tool-schemas.ts            Host-side tool derivation.
└── src/schemas/{theme,sections,video}.ts

supabase/migrations/               Schema for the OPTIONAL hosted adapter.
docs/                              This file, onboarding, decisions, glossary.
issues/                            Local issue tracker (gitignored).
```

> Two directories in older versions of this tree are gone: `apps/desktop/` (the
> Electron + CDP capture path, superseded by reading Chrome cookies in-process)
> and `apps/web/lib/mock-data/` with `scripts/seed.ts`.


---

## A worked example: "make the page breathe with what I'm watching"

You're on a watch page with a Miles Davis album cover playing. You type that prompt. Here's what happens:

1. The chat panel fires `POST /api/chat` with the message **and** the playing video's id, title, channel, and thumbnail URL.
2. The route fetches the thumbnail, encodes it to base64, and inlines it as a multimodal image block alongside the text.
3. Claude reads the message, sees the thumbnail, and reasons: *"It's a deep blue jazz album cover. The visitor wants ambient. I'll add an `AmbientBackground` section sourcing from the playing video, dim the chrome, add subtle film grain, pick smoky-blue accent + indigo background, switch to serif for the jazz mood, soften saturation."*
4. It emits ~3 tool calls in sequence:
   - `update_theme` with mode/accent/font/background/grain/chromeDim/thumbnailSaturate
   - `add_section` for `AmbientBackground` (`source: 'playingVideo'`, `particles: 'mood'`)
   - Maybe a `update_section` for the chips
5. Each tool call streams back. The browser:
   - Updates the theme variables → CSS recolors instantly
   - Adds the AmbientBackground section → `PageRoot` notices it and starts rendering soft radial-blob clouds in the page-level overlay layer, with hue derived from the watching video's id
   - Saves all three patches through the persistence adapter
6. Visually: the page exhales into a smoky blue ambient theme around the player. Reload the page tomorrow — same Miles Davis vibe.

That whole loop is ~3 seconds end-to-end (mostly Claude's response time).

---

## Performance notes

Three things keep this fast despite the heavy machinery:

- **Anthropic prompt caching** — the system prompt + schema catalog + editing rules are marked cacheable. After the first request of a session, every subsequent message reuses ~12k cached tokens and pays only for the new state + your message.
- **YouTube home feed cache** — calling `youtubei.js` cold is 4–10 seconds. We cache the home response in a 10-minute server-side `Map`. Reloads are instant.
- **Lazy section templates** — components like `MoodBoard`, `SubtitleTrack`, `AmbientBackground` are only loaded when their section actually exists in your config. You don't pay their JS cost on the home page if you've never used them.
- **Multimodal-vision keyword guard** — when you're watching a video, we only fetch the thumbnail to send to Claude when your prompt contains visual keywords (theme/vibe/color/match/etc.). Most chat turns skip the ~50–200KB image fetch entirely.

---

## Things that aren't obvious

A few patterns that took multiple revisions to land on:

- **Stable section ids matter.** The chat patches reference sections by id, not by index. So `move recommendations to the top` produces a `reorder_sections` with stable ids the LLM read off the current snapshot.
- **The mapper is defensive.** YouTube changes its response shape every few months (new node types like `lockupViewModel`, `chipCloudChipRenderer.continuationCommand` instead of `browseEndpoint.params`). The walker in `lib/innertube/client.ts` is designed to never throw — it shrinks gracefully when keys go missing. The cost of that tolerance is that a shape change yields an empty result indistinguishable from an empty feed, which is why `shape-drift` is surfaced explicitly rather than swallowed.
- **The chat tool calls are the source of truth.** The chat doesn't reply with markdown explanations. It emits patches. The "Got it — switching to dark mode" line you see in the panel is generated *client-side* from a friendly mapping over the tool names — purely cosmetic.
- **Patches compose.** A single visitor message can yield 4 tool calls. They apply in order. If two patches edit the same field, the later one wins (last-writer-wins).

---

## Want to extend it?

The cleanest extension surfaces:

- **New section type** → add a Zod schema to `packages/shared/src/schemas/sections.ts`, add a React component to `apps/web/components/templates/`, register it in `registry.tsx`, and add a hint to `lib/prompts/schema-catalog.ts` so the LLM knows about it.
- **New theme field** → add it to `theme.ts`, read it in `PageRoot.tsx` or `VideoCard.tsx`, document it in `schema-catalog.ts`.
- **New chat behavior** → add 1–2 worked examples to `lib/prompts/editing-rules.ts`. The LLM will generalize from the pattern.
- **New YouTube data source** (channel pages, playlist pages) → add a new function in `lib/innertube/client.ts` that calls `actions.execute('/browse', { browseId: '...' })` and runs the existing `extractLockupVideos` walker.

The whole codebase is built around the principle that **the visitor's intent is the unit of work.** If the LLM has the right tools and the right examples, it composes the rest.
