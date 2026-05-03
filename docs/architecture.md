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
| `set_filter` | `{ requireTags: ['jazz'] }` | merges into the filter state |
| `set_sort` | `{ by: 'density' }` | merges into the sort state |
| `add_section` | `{ sectionType: 'MoodBoard', position: { after: 'categoryChips' } }` | inserts a new section |
| `remove_section` | `{ sectionId: 'shortsRow' }` | drops a section |
| `reorder_sections` | `{ order: ['topBar', 'recommendedRow', 'videoGrid'] }` | reshuffles |

Each patch is validated against a schema (using a library called [Zod](https://zod.dev)) before we apply it. So the LLM can't accidentally write nonsense like `mode: 'spaghetti'` — it gets rejected.

> 📁 [`packages/shared/src/page-config.ts`](../packages/shared/src/page-config.ts) — the `applyPatch` reducer.
> Patches arrive from chat as `tool_use` blocks, get converted into our patch shape, and dispatched into the store.

### 4. **Persistence** — your changes stick

Each patch is also saved to a Supabase database, keyed by your `visitor_id` cookie. When you reload the page, we replay every patch you've ever made on top of the base config. That's why the page remembers you.

> 📁 [`apps/web/lib/queries/page.ts`](../apps/web/lib/queries/page.ts) — `getRenderedPage()` does the read + replay.
> [`apps/web/app/api/patch/route.ts`](../apps/web/app/api/patch/route.ts) — the write side (chat + chips both call this).
> [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) — the schema (sites, visitors, preferences, chat_turns).

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

> 📁 [`apps/web/lib/prompts/system.ts`](../apps/web/lib/prompts/system.ts), [`schema-catalog.ts`](../apps/web/lib/prompts/schema-catalog.ts), [`editing-rules.ts`](../apps/web/lib/prompts/editing-rules.ts)
> [`apps/web/app/api/chat/route.ts`](../apps/web/app/api/chat/route.ts) — assembles + sends.

### Step 3 — Claude responds with tool calls

Claude doesn't reply with prose like *"Sure, I'll change the theme."* Instead it emits structured **tool use** blocks — think of them as function calls. For your message *"use a green dark theme"*, it might emit:

```json
{ "name": "update_theme", "input": { "mode": "dark", "accent": "#22C55E" } }
```

For *"make it feel like a quiet bookshop"* it might emit a chain:

```json
{ "name": "update_theme", "input": { "mode": "light", "fontFamily": "serif",
  "background": { "kind": "paper", "from": "#f3eee0" },
  "videoCardDefaults": { "thumbnailSaturate": 0.25, "hideMeta": true } } }
{ "name": "update_section", "input": { "sectionId": "videoGrid",
  "patch": { "layout": "shelves", "columns": 2 } } }
{ "name": "update_section", "input": { "sectionId": "categoryChips",
  "patch": { "visible": false } } }
```

The tool definitions live next to the schemas so they always agree.

> 📁 [`packages/shared/src/tool-schemas.ts`](../packages/shared/src/tool-schemas.ts) — what tools are.
> [`apps/web/lib/prompts/editing-rules.ts`](../apps/web/lib/prompts/editing-rules.ts) — many examples of the LLM picking which tools to use.

### Step 4 — Stream the patches back

We don't wait for Claude to finish thinking. Each tool call streams back to the browser as it lands, via Server-Sent Events. The chat UI shows a live "Thinking…" indicator and pills like "tweaked the look" as each one arrives.

> 📁 [`apps/web/app/api/chat/route.ts`](../apps/web/app/api/chat/route.ts) — the SSE side.

### Step 5 — Apply each patch

When the browser receives a patch event, it dispatches it into the store. The store reduces the patch onto the current config (`applyPatch`), and React re-renders. Anything that depends on the changed field updates instantly.

> 📁 [`apps/web/lib/store.tsx`](../apps/web/lib/store.tsx) — `dispatch` is the entry point.

### Step 6 — Persist + remember

In parallel with the visual update, the patch is saved to Supabase. When you reload, [`getRenderedPage`](../apps/web/lib/queries/page.ts) replays your patches onto the base config in order.

---

## Composition: how arbitrary prompts become coherent

The clever part of this design isn't any single primitive — it's that the LLM **composes** them.

Look at the difference between asking for "lo-fi" vs "cyberpunk" vs "Berlin techno club":

- **lo-fi** → indigo→violet gradient bg, soft purple accent, rounded font, lg radius
- **cyberpunk** → near-black → magenta gradient, cyan accent, mono font, sm radius
- **Berlin techno club** → black→slate gradient, hot-pink accent, mono font, sharp radius (no rounding)

We didn't write code for each of these vibes. The few-shot examples teach Claude the *pattern* (vibe → mode + accent + fontFamily + radius + background), and Claude generalizes. **You can type any vibe word and get a coherent set of changes.**

The same pattern shows up everywhere:

- Typing a behavioral preference → composes `set_filter` + `set_sort` + maybe an `add_section`
- Typing an aesthetic vibe → composes `update_theme` (multiple fields at once)
- Typing a feed reorganization → composes `remove_section` + `add_section` + `update_section`
- Typing "match the page to the playing video" → Claude looks at the thumbnail (we send it as a multimodal image) and picks the whole vibe from the colors / mood

---

## The two video sources

The page can pull videos from one of two backends:

### Mock catalog (default)

168 hand-crafted videos generated once via Claude Haiku and stored in Supabase. Stable. Predictable. Anyone can run the app this way with no external dependencies.

> 📁 [`apps/web/lib/adapters/mock.ts`](../apps/web/lib/adapters/mock.ts), [`scripts/seed.ts`](../scripts/seed.ts).

### Real YouTube (opt-in)

The trick: most users on most machines run a Chrome browser. Chrome stores YouTube cookies on disk. **We read those cookies directly** (with macOS keychain permission) and use them to call YouTube's internal `youtubei` API as if we were that browser.

The result: when you set `SHOWCASE_FEED_SOURCE=youtube`, the homepage shows your *actual* feed — your subscriptions, your real chip rail (which is personalized to your watch history), your search results.

The same chat-driven personalization wraps both sources, because the chat layer only edits the `PageConfig`, not the videos themselves.

> 📁 [`apps/web/lib/innertube/`](../apps/web/lib/innertube/) — the youtubei.js wrapper + Chrome cookie reader.
> [`apps/web/lib/adapters/`](../apps/web/lib/adapters/) — selects between mock and youtube based on env.

---

## What lives where (a tour)

```
apps/web/
├── app/
│   ├── page.tsx                Server component. Loads the visitor's cookie,
│   │                           reads their config, renders the shell.
│   ├── api/
│   │   ├── chat/route.ts        The chat endpoint — assembles the prompt,
│   │   │                        calls Claude with tools, streams patches.
│   │   ├── chat/history/        GET historical chat turns for a visitor.
│   │   ├── page/route.ts        GET the current rendered config (used by
│   │   │                        Reset).
│   │   ├── patch/route.ts       POST a patch (chat + chip clicks).
│   │   ├── reset/route.ts       DELETE all preferences for a visitor.
│   │   ├── generate-content/    Claude Haiku generator for on-demand
│   │   │                        catalog backfill ("we don't have enough
│   │   │                        chill jazz, generate some").
│   │   └── yt/                  YouTube proxy: /search, /browse (with
│   │                            chip-token routing), /more (continuation
│   │                            for infinite scroll), /comments.
│   ├── components/
│   │   ├── chat/                The chat panel + message UI.
│   │   ├── site/                Page shell — TopBar, Sidebar, main.
│   │   └── templates/           One file per section type. Each one knows
│   │                            how to render itself given its props.
│   └── lib/
│       ├── store.tsx            React Context store of the live PageConfig.
│       ├── adapters/            mock + youtube + selector.
│       ├── innertube/           YouTube cookie reader + youtubei.js client +
│       │                        the JSON walker that pulls videos out of
│       │                        deeply-nested response shapes.
│       ├── prompts/             What Claude reads — system role, schema
│       │                        catalog, editing rules, few-shots.
│       ├── queries/             Server-side: read the visitor's config from
│       │                        Supabase, replay their patches, return.
│       ├── anthropic.ts         Anthropic SDK wrapper + cost estimation +
│       │                        JSONL request log.
│       └── supabase.ts          Supabase admin client.
│
packages/shared/
├── src/
│   ├── page-config.ts            The PageConfig schema + applyPatch reducer.
│   ├── tool-schemas.ts           Anthropic tool definitions (must match
│   │                             page-config patches).
│   └── schemas/
│       ├── theme.ts               Theme + VideoCardDefaults + Background.
│       ├── sections.ts            Every section type and its props.
│       └── video.ts               Video + Short + Chapter (per-video meta).
│
supabase/migrations/0001_init.sql  sites, visitors, preferences, chat_turns.
docs/                              This file + architecture decisions log.
scripts/                           seed, migrate, clean-thumbs, smoke test.
apps/desktop/                      [SUPERSEDED] Earlier Electron+CDP path.
```

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
   - Saves all three patches to Supabase
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
- **The mapper is defensive.** YouTube changes its response shape every few months (new node types like `lockupViewModel`, `chipCloudChipRenderer.continuationCommand` instead of `browseEndpoint.params`). The walker in `lib/innertube/client.ts` is designed to never throw — it shrinks gracefully when keys go missing, and the adapter falls back to mock if the result is empty.
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
