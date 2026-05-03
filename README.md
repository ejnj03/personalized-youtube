# Showcase — Personalizable YouTube

A YouTube-shaped homepage you can talk to. Type a prompt — *"make it feel like a quiet bookshop"*, *"only deep-dives I haven't watched"*, *"adapt the theme to whatever's playing"* — and the page restructures itself live. Preferences stick across reloads via a cookie-anonymous identity.

Two run modes:

| Mode | What it shows | Setup |
| --- | --- | --- |
| **Mock** (default) | A curated 168-video catalog. Full personalization (theme, layout, filters, mood-board, ambient backgrounds, subtitle overlay, etc.) all work. | Anyone, ~3 minutes. |
| **YouTube** (real) | *Your* logged-in YouTube feed — real recommendations, real chips, real search. The chat operates on top of it. | macOS + Chrome with YouTube login, ~5 minutes. |

The same chat-driven personalization layer wraps both — only the source of videos differs.

---

## Prerequisites

- **Node 20+** and **pnpm 9+** (`corepack enable && corepack prepare pnpm@9 --activate`)
- An **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com))
- A **Supabase project** (free tier is fine — used for the visitor cookie + preference patches)
- *(Mode 2 only)* **macOS** with **Chrome** installed and logged in to YouTube

---

## Setup (5 minutes)

```bash
git clone <this-repo> showcase
cd showcase
pnpm install
cp .env.example .env
```

Open `.env` and fill in:

```bash
ANTHROPIC_API_KEY=sk-ant-…
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…

# leave commented for mock mode (the default).
# uncomment to read videos from your real YouTube account:
# SHOWCASE_FEED_SOURCE=youtube
```

Then:

```bash
pnpm migrate    # applies the Supabase schema
pnpm seed       # generates the 168-video mock catalog (calls Claude Haiku, ~$0.50, ~2 min)
pnpm --filter @showcase/web dev
```

Open http://localhost:3000.

> The first chat request takes ~3 seconds (system prompt fills the cache). Every subsequent request is fast — Anthropic prompt-caching is already wired with 4 cache breakpoints.

---

## Mode 2: real YouTube data

Once the app runs in mock mode, switch to your real YouTube feed:

1. **Make sure Chrome is installed and logged in to YouTube.** (Brave / Edge / Firefox aren't supported yet — only Chrome on macOS.)
2. Add `SHOWCASE_FEED_SOURCE=youtube` to `.env`.
3. Restart the dev server.
4. **First boot will trigger a macOS keychain prompt** — *"security wants to use the Chrome Safe Storage keychain item"*. Click **Always Allow**. After that the prompt is silent forever.
5. Reload the page. You'll see your actual feed — your subscriptions, your recommended videos, your real category chips ("Music", "Podcasts", "K-Pop", or whatever YouTube shows you).

If anything breaks — keychain denied, Chrome closed, profile path different — the app falls back to the mock catalog automatically. No crashes.

### What works in YouTube mode

- The home feed (your real recommendations, ~45 videos + 18 shorts on first load)
- Category chips (each one fires a real `youtubei` filter; "Podcasts" gives you podcasts, "Music" gives you music)
- Search (real YouTube search)
- Click a video → in-app embed player with up-next column
- Infinite scroll (continuation tokens on the home grid)
- All the personalization (chat-driven theme/layout/filter changes apply to the real videos)
- Multimodal: when you're on the watch page, the chat can *see* the playing video's thumbnail and adapt the page's whole vibe to it

---

## Try these prompts

Aesthetic:
- *use a forest-green dark theme with bigger text*
- *make it feel like a quiet bookshop — cream paper, serif type, two-column shelves*
- *make YouTube feel like a 1970s record store*
- *snowfall on the homepage when it's late* (any time, really)
- *make the page breathe with what I'm watching* (on the watch view)

Behavioral:
- *show me more chill jazz, less bangers*
- *only deep-dives I haven't watched, deep-dives on top*
- *hide videos from any channel under 100k subscribers*
- *group my feed by mood — focus, wind down, sharpen*
- *Korean subtitles with hover dictionary* (on the watch view)

Layout:
- *compact mode, 5 columns*
- *show videos as a list*
- *hide the shorts row*
- *move recommendations to the top*

Each prompt produces a coherent set of changes — the chat composes primitives (`update_theme`, `set_filter`, `add_section`, etc.) rather than running a fixed scenario list. Make up your own.

---

## Project layout

```
showcase/
├── apps/web/              Next.js 15 + React 19 app — the actual showcase
│   ├── app/               Routes: /, /api/chat, /api/yt/*, /api/page, /api/patch, /api/reset
│   ├── components/        UI: site shell, chat panel, section templates
│   └── lib/               innertube/ (YouTube data), prompts/ (Claude system), adapters/, queries/
├── packages/shared/       Zod schemas (single source of truth: PageConfig, Section, Theme, Video)
├── apps/desktop/          [SUPERSEDED] Earlier Electron+CDP path; replaced by lib/innertube/.
├── supabase/migrations/   Append-only SQL
├── scripts/               One-shots: seed, migrate, clean-thumbs, demo-smoke
└── docs/                  ARCHITECTURE.md, decisions log, research notes
```

## Onboarding new contributors

1. Read [`docs/ONBOARDING.md`](docs/ONBOARDING.md) **first** — it's a 30-minute walk-through that gets the app running, makes one tiny visible change, and leaves them with a working mental model. Designed for people who don't know terms like "Server Component" yet.
2. Once you're past that, [`docs/architecture.md`](docs/architecture.md) is the deep dive on how the personalization actually works — how a chat message becomes a visible page change.
3. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) is a reference for any term you hit and don't recognize.
4. [`docs/decisions.md`](docs/decisions.md) is an append-only log of *why* we made certain calls — open it when "why is it like this?" comes up.

---

## Troubleshooting

**Page shows mock videos but I set `SHOWCASE_FEED_SOURCE=youtube`** — restart the dev server. Next.js reads env vars at process start.

**Chrome cookie keychain prompt won't go away** — click *Always Allow* (not just *Allow*); the next boot will be silent.

**`security find-generic-password` errors** — Chrome may not be installed at the default path. Set `CHROME_COOKIE_PATH=/path/to/Chrome/Default/Cookies` in `.env`.

**Empty feed after switching to YouTube mode** — make sure you're actually logged in to YouTube in Chrome. Open `chrome://settings/cookies` to confirm `youtube.com` cookies exist.

**Chat says it changed something but the page doesn't update** — hard-reload (Cmd-Shift-R). `lib/` server-side changes don't HMR cleanly.

**Cookies expire** — re-login to YouTube in Chrome and reload.

**Linux / Windows** — not supported yet. The cookie extractor is macOS-only; Chrome on other OSes uses different keychain APIs (libsecret on Linux, DPAPI on Windows). Adding either is a self-contained ~50-line change in `apps/web/lib/innertube/chrome-cookies.ts`.

---

## What's deliberately not in v0

- Replays / fixtures for chat regression — the system prompt is logged in `logs/anthropic.jsonl` so a replay harness is trivial to add when needed.
- Vercel deploy of the YouTube-mode path — won't work without your Chrome cookies. Mock mode deploys cleanly though.
- Multi-user accounts — the visitor identity is a `httpOnly` cookie, deliberately. Cross-device personalization would need a proper auth swap.

---

## Stack

Next.js 15 (App Router) · React 19 · Tailwind 3.4 · Supabase · Anthropic SDK (`claude-opus-4-7`, `claude-haiku-4-5-20251001` for catalog gen) · `youtubei.js` for YouTube data · `better-sqlite3` for the Chrome cookie reader.
