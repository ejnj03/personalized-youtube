# Persistence

Persistence is how a visitor's changes survive a reload. You pass one **adapter** to `defineHost({ persistence })`; the SDK calls it to read and write patches, chat turns, and modes. Swap adapters freely — your app code doesn't change.

```ts
import { defineHost } from '@showcase/sdk/core';
import { localStoragePersistence } from '@showcase/sdk';

const host = defineHost({ /* … */, persistence: localStoragePersistence({ namespace: 'myapp' }) });
```

## Pick an adapter

| Adapter | Where it stores | Scope | Reach for it when |
|---|---|---|---|
| `inMemoryPersistence()` | RAM (lost on refresh) | per tab | local dev, tests, throwaway demos |
| `localStoragePersistence({ namespace })` | browser `localStorage` | per browser | client-only apps, no backend |
| `cookiePersistence(opts)` | a cookie | per browser | tiny state you want sent to the server |
| `sqlitePersistence(file?)` | a local SQLite file | per visitor, **multi-mode**, one machine | local dev and self-hosted single-server apps |
| `supabasePersistence(client, opts?)` | Postgres (Supabase) | per visitor, **cross-device, multi-mode** | production, shared/server-rendered apps |

```ts
import { inMemoryPersistence, localStoragePersistence, cookiePersistence } from '@showcase/sdk';
import { sqlitePersistence } from '@showcase/sdk/sqlite';
import { supabasePersistence } from '@showcase/sdk/supabase';
```

> The three browser adapters come from the root `@showcase/sdk`. The other two are **server-only** and live behind their own entry points: `supabasePersistence` uses a service-role key, and `sqlitePersistence` needs Node's filesystem. Never import either into client code.

## SQLite (the zero-setup server path)

Server-side persistence with nothing to provision. Both reference hosts in this repo use it.

```ts
import { sqlitePersistence } from '@showcase/sdk/sqlite';

const persistence = sqlitePersistence();              // ./.showcase/showcase.db
const persistence = sqlitePersistence('.showcase/spotify.db');   // or an explicit path
```

`better-sqlite3` is an **optional peer dependency** — install it only if you use this adapter:

```bash
pnpm add better-sqlite3
```

Three things to know:

- **The default path is relative to `process.cwd()`**, so two hosts started from different directories get separate stores. That is usually right (they are different sites), but pass an explicit path to make it deliberate rather than incidental.
- **It will not work on serverless.** Those platforms give each invocation an ephemeral filesystem, so writes vanish between them. Use `supabasePersistence` there.
- **The connection opens lazily**, on first use rather than at construction, so importing a module that calls `sqlitePersistence()` does not touch the disk.

In Next.js, mark the native module external or webpack will try to bundle the `.node` binary:

```js
// next.config.mjs
const nextConfig = { serverExternalPackages: ['better-sqlite3'] };
```

## Supabase (the production path)

Construct it with an admin client and hand it to your **server** route, not the browser:

```ts
// app/api/chat/route.ts  (Next.js)
import { createNextHandler } from '@showcase/sdk/server';
import { supabasePersistence, loadSupabaseBaseConfig } from '@showcase/sdk/supabase';
import { createClient } from '@supabase/supabase-js';
import { host } from '@/personalization/host';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const { POST, runtime, dynamic } = createNextHandler({
  ...host,
  apiKey: process.env.ANTHROPIC_API_KEY!,
  persistence: supabasePersistence(admin),
});
```

### Schema it expects

`supabasePersistence` reads/writes these tables (override names via the options arg):

| Table | Key columns |
|---|---|
| `sites` | `id`, `slug`, `base_config` (jsonb) |
| `visitors` | `id` (the visitor's cookie UUID) |
| `preferences` | `visitor_id`, `site_id`, `mode_id`, `patch` (jsonb), `created_at` |
| `chat_turns` | `visitor_id`, `site_id`, `mode_id`, `user_message`, `assistant_message`, `tool_uses`, `created_at` |
| `modes` | `id`, `visitor_id`, `site_id`, `title`, `created_at` |

The migrations in [`supabase/migrations/`](../../../supabase/migrations/) describe this schema. Apply them with the Supabase CLI or its SQL editor; this repo no longer ships a `pnpm migrate` script, since the default setup is SQLite. Companion helpers `loadSupabaseBaseConfig(client, slug)` and `setSupabaseBaseConfig(client, slug, config)` read/seed the per-page `base_config`.

## Modes (save-slots) come for free

Every adapter is **mode-aware**. A _mode_ is an independent (config + chat history) pair a visitor can name and switch between — the [chat panel](chat-panel.md) ships the pills and the create/switch UI. The contract methods carry a `modeId`:

```ts
interface PersistenceAdapter {
  read(visitorId, slug, modeId): Promise<Patch[]>;
  write(visitorId, slug, modeId, patches): Promise<void>;
  reset(visitorId, slug, modeId): Promise<void>;
  recordTurn(visitorId, slug, modeId, turn): Promise<void>;
  readTurns(visitorId, slug, modeId, limit?): Promise<ChatTurn[]>;
  listModes(visitorId, slug): Promise<Mode[]>;
  createMode(visitorId, slug, title): Promise<Mode>;
}
```

If you don't surface mode UI, everything just resolves to a single default mode — you never have to think about it.

## Writing your own

It's a plain object satisfying `PersistenceAdapter` — back it with Redis, a REST API, Durable Objects, whatever. The simplest reference is [`inMemoryPersistence`](../src/client/persistence/in-memory.ts); the fullest is [`supabasePersistence`](../src/client/persistence/supabase.ts).

## See also

- **[Server](server.md)** — where the server-side adapter gets wired into the chat route.
- **[Chat Panel](chat-panel.md)** — the mode pills that drive `listModes` / `createMode`.
- **[Concepts](concepts.md)** — what a `Patch` and a `ChatTurn` actually are.
