# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This package has not been released yet. Everything below lives under
> **[Unreleased]**; cut the first versioned section (e.g. `[0.1.0]`) with a date
> when you publish. Don't backfill invented release history.

## [Unreleased]

### Added — `@showcase/sdk`

- **Host config** — `defineHost()` derives Claude tool definitions, the prompt
  catalog, and runtime validators from your Zod schemas.
- **Four entry points** — `@showcase/sdk` (client), `@showcase/sdk/core`
  (server-safe pure core), `@showcase/sdk/server` (route handlers),
  `@showcase/sdk/supabase` (server persistence).
- **Theme system** — `defineTokens` (8 CSS-variable color tokens),
  `defineFonts` (self-describing font catalog), `defineCardPresets` and
  `defineLayoutPresets`.
- **`<PersonalizationRoot>`** — holds the live `PageConfig`, publishes theme
  tokens to CSS variables, and injects the chosen font.
- **`<ChatPanel>`** — chat UI with streaming responses, mode (save-slot) pills,
  per-mode history, and reset.
- **Patch model** — `applyPatch` / `applyPatches` fold typed edits onto a
  `PageConfig`.
- **Persistence adapters** — in-memory, cookie, localStorage, and a mode-aware
  Supabase adapter.
- **Server handlers** — `createNextHandler` (Next.js) and `createChatHandler`
  (any Web-standard server), with Anthropic prompt-cache-aware system prompts.
- **Documentation** — [getting started](packages/sdk/docs/getting-started.md),
  [theme](packages/sdk/docs/theme.md), [sections](packages/sdk/docs/sections.md),
  [persistence](packages/sdk/docs/persistence.md),
  [chat panel](packages/sdk/docs/chat-panel.md),
  [server](packages/sdk/docs/server.md), and
  [concepts](packages/sdk/docs/concepts.md).

### Added — reference apps

- **YouTube clone** (`apps/web`) — Next.js host on real YouTube data via
  `youtubei.js`, with a Library/playlists view, mode-aware persistence, and a
  TTL caching layer for upstream reads.
- **Spotify clone** (`spotify-react-web-client`) — CRA host + Hono server,
  Spotify Web Playback SDK, and LRClib lyrics.

[Unreleased]: https://github.com/<org>/<repo>/commits/main
