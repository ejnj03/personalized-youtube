# @showcase/sdk

> Drop chat-driven personalization into any web app. Your users type what they want — _"forest-green dark theme, hide shorts, bigger cards"_ — and the page updates live and **sticks** across reloads.

The SDK gives you the whole loop: a typed page model, an Anthropic-powered chat panel, a streaming server handler, theming, and persistence — so you mostly just **mount two components and add one route**. Your app's top-level structure stays the way it is.

```tsx
<PersonalizationRoot host={host} fontCatalog={fontCatalog}>
  <YourExistingApp />
  <ChatPanel host={host} pageSlug="myapp" apiUrl="/api/chat" />
</PersonalizationRoot>
```

That's the integration. The rest is configuration.

---

## ✨ What you get

- **Chat → live UI.** Claude turns plain-language requests into typed _patches_ that your page renders instantly.
- **Sticky preferences.** Every change persists; returning visitors get their personalized view automatically.
- **Modes (save-slots).** Visitors keep multiple named personalizations and switch between them — the chat panel ships the pills.
- **Theming as data.** 8 universal color tokens + a font catalog + card/layout presets, all driven by chat and published to CSS variables. → **[Theme guide](docs/theme.md)**
- **Bring-your-own everything.** Your components, your data, your styling. The SDK orchestrates; it doesn't take over.

## 🚀 Install

```bash
pnpm add @showcase/sdk
# peers (you almost certainly already have these):
pnpm add react react-dom zod
# optional, only if you use the Supabase persistence adapter:
pnpm add @supabase/supabase-js
```

Then follow the **[Getting Started guide](docs/getting-started.md)** — it walks you from empty to a working personalization loop in ~5 steps.

## ⚡ 60-second mental model

```
┌─ visitor types in <ChatPanel> ─────────────────────────────┐
│  "make it cozier, hide the sidebar"                         │
└───────────────┬────────────────────────────────────────────┘
                ▼  POST /api/chat   (your route → createChatHandler)
        Claude returns tool calls  →  typed Patches  (streamed back)
                ▼
   <PersonalizationRoot> applies patches → your components re-render
                ▼
        persistence.write(...)   →  reload-safe, per-mode
```

You define **what's editable** (a theme schema + a few section schemas). The SDK derives the Claude tools, the prompt, and the validators from those schemas — so adding a knob is a one-line schema change, not a prompt-engineering project. → **[Concepts](docs/concepts.md)**

## 📦 Entry points

The package ships four import paths. Picking the right one matters in frameworks with a server/client split (Next.js):

| Import | Use it for | Runs on |
|---|---|---|
| `@showcase/sdk` | `PersonalizationRoot`, `ChatPanel`, hooks | **client** components |
| `@showcase/sdk/core` | `defineHost`, `defineTokens`, `defineFonts`, patch model, prompts | **server + client** (pure, no `'use client'`) |
| `@showcase/sdk/server` | `createNextHandler`, `createChatHandler` | **server** route handlers |
| `@showcase/sdk/sqlite` | `sqlitePersistence` | **server** (Node fs; optional `better-sqlite3`) |
| `@showcase/sdk/supabase` | `supabasePersistence`, `loadSupabaseBaseConfig` | **server** (service-role key) |

> 🔑 **The one rule that trips people up:** when a module is evaluated on the server (e.g. a Next.js RSC or a schema imported by a route), import theme/host builders from **`@showcase/sdk/core`**, not the root barrel. The root barrel bundles the client components and carries a hoisted `'use client'`. More in **[Concepts → the client/server boundary](docs/concepts.md#the-client--server-boundary)**.

Plus a stylesheet for the chat panel:

```ts
import '@showcase/sdk/styles.css';
```

## 📚 Documentation

Start here, branch out as needed:

1. **[Getting Started](docs/getting-started.md)** — integrate the SDK into an existing app, step by step.
2. **[Theme](docs/theme.md)** — color tokens, fonts, card & layout presets.
3. **[Sections](docs/sections.md)** — define the editable regions of your page.
4. **[Chat Panel](docs/chat-panel.md)** — `<ChatPanel>` props, modes, and custom tool handlers.
5. **[Persistence](docs/persistence.md)** — in-memory, cookie, localStorage, and Supabase adapters.
6. **[Server](docs/server.md)** — wiring the chat route (Next.js & any Web-standard server).
7. **[Concepts](docs/concepts.md)** — `PageConfig`, patches, the prompt cache, and the client/server boundary.

## 🏗️ Real integrations to crib from

Two complete hosts live in this monorepo — the fastest way to see the whole picture:

- **YouTube clone** (Next.js, App Router) — server-rendered, Supabase persistence, real data adapter.
  - Host: [`apps/web/lib/personalization.ts`](../../apps/web/lib/personalization.ts) · Theme: [`packages/shared/src/schemas/theme.ts`](../shared/src/schemas/theme.ts) · Route: [`apps/web/app/api/chat/route.ts`](../../apps/web/app/api/chat/route.ts)
- **Spotify clone** (Vite SPA + Hono server) — the smallest end-to-end host.
  - Host: [`spotify-react-web-client/src/personalization/host.ts`](../../spotify-react-web-client/src/personalization/host.ts) · Theme/schemas: [`…/personalization/schemas.ts`](../../spotify-react-web-client/src/personalization/schemas.ts) · Mount: [`…/src/App.tsx`](../../spotify-react-web-client/src/App.tsx)

---

<sub>Built on the [Anthropic API](https://docs.anthropic.com/en/api/overview) · Schemas powered by [Zod](https://zod.dev).</sub>
