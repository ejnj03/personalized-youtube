# Showcase — chat-driven personalization

> Talk to your UI. Type _"forest-green dark theme, hide shorts, bigger cards"_ and the page rewrites itself live — and **remembers** across reloads.

This is a monorepo with one reusable product and two apps that prove it out:

| | What it is | |
|---|---|---|
| 🧩 **[`@showcase/sdk`](packages/sdk/)** | The product. Drop chat-driven personalization into any React app — typed page model, Anthropic-powered chat panel, theming, persistence. | **[Docs →](packages/sdk/README.md)** |
| ▶️ **[YouTube clone](apps/web/)** | A full Next.js host built on the SDK, running on **real** YouTube data. | [Run it ↓](#-run-the-youtube-clone) |
| 🎧 **[Spotify clone](spotify-react-web-client/)** | A second host (CRA + Hono server) — proves the SDK isn't YouTube-shaped. **A fork** (see [attribution](#-attribution)). | [Run it ↓](#-run-the-spotify-clone) |

The two apps share **zero** personalization code — they just configure the SDK differently. That's the whole point: the SDK is the engine; the clones are showcases.

---

## 🧩 Start with the SDK

If you're here to *use* the personalization engine, you barely need this repo — head straight to the package:

- **[SDK overview & install](packages/sdk/README.md)**
- **[Getting Started](packages/sdk/docs/getting-started.md)** — integrate into an existing app in ~5 steps
- **[Theme](packages/sdk/docs/theme.md)** · **[Sections](packages/sdk/docs/sections.md)** · **[Persistence](packages/sdk/docs/persistence.md)** · **[Chat Panel](packages/sdk/docs/chat-panel.md)** · **[Server](packages/sdk/docs/server.md)** · **[Concepts](packages/sdk/docs/concepts.md)**

The rest of this README is about running the two **reference apps** locally — the best way to see the SDK in action and to crib a real integration.

## 📁 Repo layout

```
showcase/
├── packages/
│   ├── sdk/                 🧩 @showcase/sdk — the personalization engine (start here)
│   └── shared/              Zod schemas the YouTube clone builds on (PageConfig, Theme, sections)
├── apps/
│   └── web/                 ▶️ YouTube clone — Next.js 15 host
├── spotify-react-web-client/ 🎧 Spotify clone — CRA host + Hono chat/lyrics server
└── supabase/migrations/     Shared Postgres schema (visitors, preferences, modes, chat turns)
```

> A reference integration to read end-to-end: the YouTube host is [`apps/web/lib/personalization.ts`](apps/web/lib/personalization.ts); the Spotify host is [`spotify-react-web-client/src/personalization/host.ts`](spotify-react-web-client/src/personalization/host.ts). Both are tiny.

---

## 🛠️ One-time setup

**Prerequisites**

- **Node 20+** and **pnpm 9+** — `corepack enable && corepack prepare pnpm@9 --activate`
- An **[Anthropic API key](https://console.anthropic.com)**
- A **[Supabase](https://supabase.com) project** (free tier) — stores the visitor cookie identity + preference patches + modes
- *(Spotify clone)* a **[Spotify developer app](https://developer.spotify.com/dashboard)** for OAuth
- *(YouTube clone, real-feed mode)* **macOS + Chrome** logged in to YouTube

**Install & configure**

```bash
git clone <this-repo> showcase
cd showcase
pnpm install
cp .env.example .env        # both apps read this single root .env
```

Fill in `.env`:

```bash
# Claude (both apps)
ANTHROPIC_API_KEY=sk-ant-…

# Supabase (both apps)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
SUPABASE_ACCESS_TOKEN=…        # only needed to run migrations

# Spotify OAuth (Spotify clone only)
# SPOTIFY_CLIENT_ID=…   SPOTIFY_CLIENT_SECRET=…   (+ redirect URI in your Spotify dashboard)
```

Apply the database schema once:

```bash
pnpm migrate        # creates visitors / preferences / modes / chat_turns
```

> 💾 Persistence is **mode-aware** — every visitor can keep multiple named save-slots and switch between them. Details in **[SDK → Persistence](packages/sdk/docs/persistence.md)**.

---

## ▶️ Run the YouTube clone

```bash
pnpm --filter @showcase/web dev      # http://localhost:3000
```

By default it reads **your real YouTube feed** from Chrome's cookies (macOS):

- First boot triggers a one-time macOS keychain prompt — _"security wants to use the Chrome Safe Storage keychain item"_. Click **Always Allow**; it's silent forever after.
- You'll see your actual recommendations, subscriptions, category chips, and search. Click a video for the in-app player; the Library tab shows your real playlists.
- **No Chrome / not on macOS / not logged in?** It falls back to an **anonymous** (generic) feed automatically — the whole personalization layer still works, just on un-personalized videos.

Then open the chat panel and try _"dark theme"_, _"make it feel like a quiet bookshop"_, _"hide the shorts row"_, _"only deep-dives I haven't watched"_.

## 🎧 Run the Spotify clone

> 🍴 **This app is a fork** of [francoborrelli/spotify-react-web-client](https://github.com/francoborrelli/spotify-react-web-client) (MIT). We added the `@showcase/sdk` personalization layer (chat panel, theme, the Hono chat/lyrics server) on top of Franco's Spotify client. See [Attribution](#-attribution).

It's a client + a small server (chat, lyrics, music-video lookup). Run both:

```bash
pnpm --filter spotify-client server     # Hono API on http://localhost:8787
pnpm --filter spotify-client start      # CRA app on http://localhost:3001
```

Log in with Spotify (Web Playback SDK handles playback), then personalize the same way — _"forest green theme"_, _"bigger now-playing"_. Lyrics come from [LRClib](https://lrclib.net); the chat panel is the exact same SDK component the YouTube clone uses.

---

## ☁️ Deploying

The apps run cleanly in the cloud in **anonymous / showcase mode** (full chat personalization + Supabase persistence). Serving a *logged-in* real account from a cloud host is possible but inherits cookie-expiry and YouTube's datacenter-IP anti-bot behavior — the real-data path is happiest running locally. See **[SDK → Server](packages/sdk/docs/server.md)** for the chat-route wiring either way.

## 🧱 Stack

**SDK** — TypeScript · [Zod](https://zod.dev) · [Anthropic SDK](https://docs.anthropic.com/en/api/overview) (Claude Opus for chat) · React 18/19 peer.
**YouTube clone** — Next.js 15 (App Router) · React 19 · Tailwind · `youtubei.js` (real data via Chrome cookies) · Supabase.
**Spotify clone** — CRA · Hono server · Spotify Web Playback SDK · LRClib · Supabase.

## 📜 Attribution

The **Spotify clone** (`spotify-react-web-client/`) is a **fork** of:

> **[francoborrelli/spotify-react-web-client](https://github.com/francoborrelli/spotify-react-web-client)** — © Franco Martín Borrelli, licensed **MIT**.

We forked Franco's Spotify web client and layered the `@showcase/sdk` personalization engine on top (the chat panel, theming, and the Hono chat/lyrics server under `spotify-react-web-client/server/`). The upstream MIT license is retained in [`spotify-react-web-client/LICENSE`](spotify-react-web-client/LICENSE); please keep it. The **YouTube clone** and **`@showcase/sdk`** are original to this repository.

---

<sub>The personalization engine lives in [`packages/sdk`](packages/sdk/) — everything else is a demonstration of it.</sub>
