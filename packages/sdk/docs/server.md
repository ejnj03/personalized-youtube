# Server

The chat panel POSTs to a route on your server. That route runs the SDK's chat handler, which calls Claude, streams the response, and writes patches through your [persistence adapter](persistence.md). This is also the **only** place your real Anthropic API key lives.

Two factories, same engine:

- `createNextHandler(host)` — for Next.js App Router routes.
- `createChatHandler(host)` — a Web-standard `(Request) => Promise<Response>` for any other server (Hono, Bun, Deno, Express-with-Request…).

Both live in **`@showcase/sdk/server`** (server-safe — no client bundle).

## Next.js

```ts
// app/api/chat/route.ts
import { createNextHandler } from '@showcase/sdk/server';
import { supabasePersistence } from '@showcase/sdk/supabase';
import { createClient } from '@supabase/supabase-js';
import { host } from '@/personalization/host';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const { POST, runtime, dynamic } = createNextHandler({
  ...host,                                   // your shared host config…
  apiKey: process.env.ANTHROPIC_API_KEY!,    // …with the real key supplied here
  persistence: supabasePersistence(admin),   // …and a server-side adapter
});
```

`createNextHandler` returns the `POST`, `runtime: 'nodejs'`, and `dynamic: 'force-dynamic'` exports Next needs for streaming.

> 🔁 **The host pattern:** keep a single `host` in `personalization/host.ts` with a *stub* key/persistence so it's safe to import into client components. On the server, spread it and override `apiKey` + `persistence` with the real ones — exactly as above. See the [YouTube clone's route](../../../apps/web/app/api/chat/route.ts).

## Any Web-standard server

```ts
import { createChatHandler } from '@showcase/sdk/server';
import { host } from './personalization/host';

const chat = createChatHandler({ ...host, apiKey: process.env.ANTHROPIC_API_KEY! });

// Hono:
app.post('/api/chat', (c) => chat(c.req.raw));      // give it a Request, return its Response
```

The Spotify clone uses exactly this on a Hono server — see [`spotify-react-web-client/server/index.ts`](../../../spotify-react-web-client/server/index.ts).

## The wire protocol

Mostly you don't care — `<ChatPanel>` speaks it for you. For reference:

**Request body** (POST):
```jsonc
{ "pageSlug": "myapp", "message": "dark theme",
  "history": [/* prior {role, content} turns */],
  "visitorId": "…",   // SPA hosts pass this; cookie hosts can rely on a visitor_id cookie
  "modeId": "…" }     // which save-slot this turn writes to
```

**Response** is a stream of server-sent events — assistant text deltas plus `{ kind: 'patch', … }` events the panel applies optimistically. Patches are also written to persistence for the active mode.

## The other routes (host-provided)

The SDK ships the **chat** handler. The mode/page/history/reset endpoints the [chat panel expects](chat-panel.md#endpoints-it-expects) are small host routes you own — they just call your persistence adapter. Copyable versions live in the YouTube clone:

- [`app/api/modes/route.ts`](../../../apps/web/app/api/modes/route.ts) — list/create modes
- [`app/api/page/route.ts`](../../../apps/web/app/api/page/route.ts) — a mode's merged config
- [`app/api/chat/history/route.ts`](../../../apps/web/app/api/chat/history/route.ts) — a mode's transcript
- [`app/api/reset/route.ts`](../../../apps/web/app/api/reset/route.ts) — wipe the active mode

## Import-path checklist

| You're importing | From |
|---|---|
| `createNextHandler`, `createChatHandler` | `@showcase/sdk/server` |
| `sqlitePersistence` | `@showcase/sdk/sqlite` |
| `supabasePersistence`, `loadSupabaseBaseConfig` | `@showcase/sdk/supabase` |
| `defineHost`, theme builders, `applyPatches` | `@showcase/sdk/core` |
| `PersonalizationRoot`, `ChatPanel`, hooks | `@showcase/sdk` (client only) |

Why it matters: **[Concepts → the client/server boundary](concepts.md#the-client--server-boundary)**.

## See also

- **[Persistence](persistence.md)** — the adapter the handler writes through.
- **[Chat Panel](chat-panel.md)** — the client side of this route.
- **[Concepts](concepts.md)** — patches, the prompt cache, and streaming.
