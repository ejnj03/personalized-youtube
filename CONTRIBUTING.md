# Contributing

Thanks for working on this! 💛 This is a pnpm monorepo: one reusable package (**`@showcase/sdk`**) and two apps that demonstrate it (the **YouTube** and **Spotify** clones). The SDK is the product; the apps are showcases. Most contributions land in one of those three.

> New here? Read the [root README](README.md) first for the layout, then the [SDK docs](packages/sdk/README.md) if you're touching the engine.

## Setup

```bash
nvm use                                  # Node 20 — see .nvmrc
corepack enable && corepack prepare pnpm@9 --activate
pnpm install
pnpm --filter @showcase/sdk build        # apps resolve @showcase/sdk to its gitignored dist/
cp .env.example .env                     # ANTHROPIC_API_KEY (both apps read this one file)
```

No database step. Persistence is a local SQLite file created on first write.

**Node 20 specifically.** `better-sqlite3` ships a native binary compiled for one
Node ABI, so installing under a different major leaves a binary the other major
cannot load.

Run what you're working on:

```bash
pnpm --filter @showcase/web dev              # YouTube clone  → http://localhost:3000
pnpm --filter spotify-client run dev:server  # Spotify API    → http://localhost:8787
pnpm --filter spotify-client run start       # Spotify client → http://localhost:3001
pnpm --filter @showcase/sdk dev              # rebuild the SDK on change (watch mode)
```

Full setup details live in the [README](README.md).

## Where things live

```
packages/sdk/     🧩 the engine — edit here to change SDK behavior (see its docs/ )
packages/shared/  Zod schemas the YouTube clone builds on
apps/web/         YouTube clone (Next.js host)
spotify-react-web-client/  Spotify clone (CRA host + Hono server)
supabase/migrations/       Postgres schema for the optional hosted adapter
```

If you change the SDK, run its watch build (`pnpm --filter @showcase/sdk dev`) so the apps pick up your changes — they consume the built `dist/`.

## Conventions that matter

These aren't style nits — breaking them breaks the system:

- **🔑 Respect the import boundary.** The SDK ships four entry points. From any module that runs on the server (a Next RSC, a route handler, or a schema imported by one), import builders from **`@showcase/sdk/core`** — never the root `@showcase/sdk`, which carries a hoisted `'use client'`. Full explanation: [Concepts → the boundary](packages/sdk/docs/concepts.md#the-client--server-boundary).
- **Zod schemas are the single source of truth.** React props, Claude's tools, and runtime validators all derive from one schema. Add the prop to the schema; don't hand-write a tool definition or validator.
- **Migrations are append-only.** Never edit a merged file in `supabase/migrations/` — add a new numbered one, idempotent (`create … if not exists`). These describe the schema `supabasePersistence` targets; the default local setup uses SQLite and does not run them.
- **Section IDs are stable.** Never regenerate an existing section's `id`; patches reference it across edits.
- **Keep section/theme props flat.** Claude edits `props.headline`, not `props.content.heading.text`.
- **Don't bust the prompt cache.** Per-visitor state goes last in the system prompt. If you touch prompt assembly, keep volatile content after the cacheable segments (see [Concepts → the prompt cache](packages/sdk/docs/concepts.md#the-prompt-cache)).
- **No comments unless they explain a non-obvious *why*.**

## Adding common things

| You want to… | Do this | Reference |
|---|---|---|
| Add a theme knob (color, font, preset) | extend the host's `ThemeSchema` | [Theme](packages/sdk/docs/theme.md) |
| Make a new region editable | add a `{ schema, component, description }` to `host.sections` | [Sections](packages/sdk/docs/sections.md) |
| Store data somewhere new | implement the `PersistenceAdapter` interface | [Persistence](packages/sdk/docs/persistence.md) |
| Expose a new SDK symbol | export it from the right entry's `index.ts` (`core` / `server` / root) and rebuild | [Concepts](packages/sdk/docs/concepts.md) |

## Before you open a PR

```bash
pnpm typecheck     # strict; CI gates on this
pnpm lint
pnpm test
```

- Keep changes **scoped to one workspace** where possible; cross-cutting changes (e.g. a schema in `packages/shared` consumed by `apps/web`) should land together and typecheck as a unit.
- If you changed SDK behavior, **update its docs** in `packages/sdk/docs/` in the same PR. Docs links are checked — don't leave dead ones.
- Write a clear PR description: what changed, why, and how you verified it.

## Docs

The SDK docs under [`packages/sdk/docs/`](packages/sdk/docs/) are part of the product. When you add or change a public API, update the relevant guide and cross-link it. Keep the friendly, hyperlink-out-to-detail style — setup/theme pages stay focused; implementation depth lives in [Concepts](packages/sdk/docs/concepts.md).

---

Questions or a change you're unsure about? Open a draft PR or an issue and ask — early feedback beats a big rewrite later.
