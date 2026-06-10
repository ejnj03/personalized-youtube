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
| `supabasePersistence(client, opts?)` | Postgres (Supabase) | per visitor, **cross-device, multi-mode** | production, shared/server-rendered apps |

```ts
import { inMemoryPersistence, localStoragePersistence, cookiePersistence } from '@showcase/sdk';
import { supabasePersistence } from '@showcase/sdk/supabase';
```

> The three browser adapters come from the root `@showcase/sdk`. `supabasePersistence` lives in `@showcase/sdk/supabase` because it's **server-only** (it uses a service-role key — never import it into client code).

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

The migrations in [`supabase/migrations/`](../../../supabase/migrations/) set this up — run `pnpm migrate` from the repo root. Companion helpers `loadSupabaseBaseConfig(client, slug)` and `setSupabaseBaseConfig(client, slug, config)` read/seed the per-page `base_config`.

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
