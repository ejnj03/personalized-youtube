# Glossary

Plain-language definitions for terms used throughout this codebase. If you read any of the docs and see something here you don't recognize, jump back here. **Most readers don't need to know every term — only the ones you actually trip over.**

---

## The product

**Showcase / showcase app** — this project. A YouTube-shaped homepage that responds to natural-language prompts ("make it green", "hide shorts") by restructuring itself live.

**Visitor** — anyone using the running app in their browser. We give each one an anonymous cookie so we can remember their preferences without making them log in.

**Personalization** — any change the visitor makes to the page through chat. Color changes, layout changes, filter changes, etc. All personalization flows through the same chat → tool-call → patch loop.

---

## The page model

**`PageConfig`** — *the* central data structure. A single JSON-shaped object describing the entire visible page: what sections exist, what theme is applied, what filters are active. Lives in [`packages/shared/src/page-config.ts`](../packages/shared/src/page-config.ts).

> Mental model: a recipe. Change the recipe, the cake changes.

**Section** — one rectangular block on the page. Examples: TopBar, Sidebar, VideoGrid, ShortsRow, MoodBoard, AmbientBackground. Each section has a `type`, an `id`, and a bag of `props` specific to its type.

**Theme** — page-wide visual settings: dark/light mode, accent color, font family, background, corner radius, etc. One theme per page; applies globally.

**Filter** — visitor-defined rules about *which* videos to show: tag include/exclude, channel block, watched-or-not, min duration, min subscriber count, etc.

**Sort** — what order the videos appear in. `recommended` (default), `recent`, `popular`, `duration`, `density`, `mood`.

**Patch** — a small JSON change to the `PageConfig`. Five patch kinds: `update_theme`, `update_section`, `add_section`, `remove_section`, `reorder_sections`. (`request_more_content` and `ask_user` are also tools, but they are side effects and produce no patch.) `set_filter` and `set_sort` were removed; filter and sort are ordinary `PageConfig` fields edited through `update_section`. The chat panel produces patches; the store applies them.

---

## The chat / agent layer

**LLM** — large language model. In this app, that's [Claude](https://www.anthropic.com/claude). It reads the visitor's message and decides what should change.

**Tool / Tool call / `tool_use`** — Claude's structured output. Instead of replying with prose ("I'll make it green"), Claude emits a `tool_use` block like `{ name: 'update_theme', input: { accent: '#22C55E' } }`. Each tool corresponds to one of the seven patch kinds.

**System prompt** — the instructions we give Claude *before* the visitor's message. Tells it what tools exist, what the schemas look like, and gives it ~30 worked examples ("when the visitor says 'lo-fi', emit these specific values").

**Prompt caching** — an Anthropic feature that lets us mark parts of the system prompt as cacheable. After the first request, repeat requests reuse the cached prefix at ~10% the cost. Why this matters: keeps each chat round fast and cheap.

**Few-shot example** — a worked input/output pair we put in the system prompt to teach the LLM a pattern. (E.g. "Visitor says 'cyberpunk' → emit these tools with these values.") The LLM generalizes from examples to handle prompts we never wrote examples for.

**Multimodal / vision** — Claude can read images, not just text. When you're on the watch page, we attach the playing video's thumbnail as an image so Claude can sample its colors for "match the page to this video"-style prompts.

---

## The render layer

**Component** — a React building block. A function that takes some props (data) and returns HTML. The big ones in this app: `Site`, `PageRoot`, `VideoGrid`, `VideoCard`, `ChatPanel`.

**Props** — data passed *into* a component. E.g., `<VideoGrid columns={4} videos={...}>` passes `columns: 4` as a prop.

**State** — data that lives *inside* a component or store and changes over time. The current `PageConfig` is state.

**Store** — our central state holder. Lives in [`apps/web/lib/store.tsx`](../apps/web/lib/store.tsx). Components read the current `PageConfig` from it and re-render when it changes.

**Hook** — a React function whose name starts with `use`. Hooks let components read store state, run side-effects, etc. The main one in this app is `usePageStore()`.

**Re-render** — React's term for "regenerate the HTML for this part of the page". Happens automatically when state changes. Cheap because React only updates what actually differs.

**Server Component / Client Component** — Next.js distinction. *Server components* render once on the server and ship as HTML. *Client components* (`'use client'`) ship as JavaScript that runs in the browser; they handle clicks, state, etc. Most templates in `apps/web/components/templates/` are client components because they need to react to chat patches.

**SSE (Server-Sent Events)** — how the chat streams responses back from the server. Each tool call is sent as a separate event; the browser applies them as they arrive instead of waiting for the whole response.

---

## The data layer

**Adapter** — the backend that supplies videos. There is one: the youtube adapter (real YouTube via Chrome cookies). The selector in [`apps/web/lib/adapters/index.ts`](../apps/web/lib/adapters/index.ts) forwards its `'ok'` results and returns an **empty feed** otherwise. A `mockAdapter` with a 168-video catalog used to be the default; it was removed, and there is no `SHOWCASE_FEED_SOURCE` env var.

**PersistenceAdapter** — the separate, unrelated adapter interface for *storage* (7 methods: read, write, reset, recordTurn, readTurns, listModes, createMode). Five implementations ship with the SDK. Both hosts use `sqlitePersistence`.

**`youtubei` / `youtubei.js`** — YouTube's *internal* API + a Node library that wraps it. We use it because YouTube's official Data API doesn't return personalized recommendations.

**Innertube** — `youtubei.js`'s name for the session object you authenticate once and then use to make many requests.

**Chrome cookie store** — Chrome saves your YouTube cookies in an encrypted SQLite file on disk. We read those cookies (with macOS keychain permission) so our server can talk to YouTube as if it were *your* logged-in browser.

**Continuation token** — an opaque string YouTube returns at the bottom of any browse/search response. Sending it back gets the next page (or the chip-filtered subset).

**`lockupViewModel`** — YouTube's modern "card" data shape. Each video on the homepage is a `lockupViewModel`. Our walker extracts videos by recognizing this shape.

**Walker / parser / mapper** — the function that takes YouTube's deeply-nested JSON response and pulls out the bits we care about (title, thumbnail, channel, etc.). Lives in [`apps/web/lib/innertube/client.ts`](../apps/web/lib/innertube/client.ts) → `extractLockupVideos`.

---

## Tools we use

**Next.js** — the React framework that runs the server, hot-reloads during dev, and serves the static parts. Version 15, App Router.

**Tailwind** — a CSS library where you write classes like `bg-blue-500 px-4 rounded-lg` instead of separate stylesheets.

**Zod** — a schema validation library. Lets us write `z.object({ accent: z.string() })` once and use it both for types in TypeScript *and* for runtime validation. Why this matters: an LLM might emit slightly-wrong data; Zod catches it before it touches the page.

**Supabase** — a hosted Postgres database. `supabasePersistence` still ships in the SDK for anyone who wants shared, cross-device storage, but **nothing in this repo uses it**. Visitor state goes to a local SQLite file, and the base `PageConfig` lives in code ([`apps/web/lib/base-config.ts`](../apps/web/lib/base-config.ts)), not a table.

**pnpm** — like `npm`, but faster and with built-in support for monorepos (multiple packages in one repo).

**Turborepo** — a tool that runs scripts across the monorepo packages efficiently. You'll mostly only see it in `package.json` scripts.

**Anthropic SDK** — the npm package we use to talk to Claude. Wraps the HTTP API.

**`better-sqlite3`** — a Node library that reads SQLite databases. We use it to read Chrome's cookie store.

---

## "Server-side" vs "client-side"

When we say something happens **server-side**, we mean it runs on Next.js's server process, *not* in the visitor's browser. E.g., reading the Chrome cookie store and calling YouTube — both server-side. The visitor's browser never sees the cookies or the API key.

**Client-side** means it runs in the visitor's browser. Clicking a chip, dragging the chat window, applying a patch to the visible UI — all client-side.

This distinction matters because:
- Secrets (API keys, cookies) only ever live server-side.
- Heavy work (LLM calls, YouTube fetches, database writes) happens server-side.
- Interactive bits (animations, drag, click) happen client-side.

A typical chat round: visitor types in the *client* → fires HTTP request to *server* → server calls Claude → server streams patches back → *client* applies them and re-renders.
