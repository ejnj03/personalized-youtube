# Getting Started

This guide adds chat-driven personalization to an **existing** React app. The footprint is small on purpose — you'll create one or two new files and touch your root layout once. Your existing components and routing stay put.

By the end you'll have: a chat panel that turns plain-language requests into live, persisted UI changes.

> 👀 Prefer reading code? Two complete hosts: the **[Spotify clone](../../../spotify-react-web-client/src/personalization/)** (smallest, Vite SPA) and the **[YouTube clone](../../../apps/web/lib/personalization.ts)** (Next.js, server-rendered). This guide is the narrated version of those.

---

## Prerequisites

- A React 18 or 19 app.
- An [Anthropic API key](https://console.anthropic.com/).
- A few minutes. ☕

## 0. Install

```bash
pnpm add @showcase/sdk
pnpm add react react-dom zod          # peers — you likely have these already
```

Set your key in the environment that runs your **server** (never the browser):

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

## 1. Describe your theme

Create a `personalization/` folder. Start with `schemas.ts` — the single source of truth for what's editable. The smallest useful theme is the 8 color **tokens** plus a **font** picker:

```ts
// personalization/schemas.ts
import { z } from 'zod';
import { defineTokens, defineFonts } from '@showcase/sdk/core';

const fonts = defineFonts({}, { defaultKey: 'inter' });
export const fontCatalog = fonts.catalog;        // pass this to the provider in step 4

export const ThemeSchema = z.object({
  tokens: defineTokens({
    bg: '#ffffff', fg: '#0a0a0a',
    surface: '#ffffff', muted: '#f4f4f5', mutedFg: '#71717a',
    border: '#e4e4e7', accent: '#2563eb', accentFg: '#ffffff',
  }),
  fontFamily: fonts.schema,
});

export type Theme = z.infer<typeof ThemeSchema>;
```

> 🎨 `defineTokens` and `defineFonts` are the heart of theming — what each token means, how fonts resolve, and card/layout presets are all in the **[Theme guide](theme.md)**.
>
> 🔑 Note the import path: **`@showcase/sdk/core`**, not `@showcase/sdk`. This file gets evaluated on the server, so it must avoid the client barrel. See **[the client/server boundary](concepts.md#the-client--server-boundary)**.

Your components read these as CSS variables — `var(--bg)`, `var(--accent)`, etc. The SDK publishes them to `<html>` for you (step 4). So a button is just:

```tsx
<button style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>Subscribe</button>
```

## 2. (Optional) Define editable sections

A **section** is a region of your page Claude can add, remove, reorder, or tweak (a hero, a product grid, a notes pane…). Each is a Zod schema + a React component. You can start with **zero** sections (theme-only personalization works great) and add them later.

```ts
// personalization/sections.tsx
import { z } from 'zod';
import type { DefineHostInput } from '@showcase/sdk/core';
import { HeroBanner } from '../components/HeroBanner';

export const sections: DefineHostInput['sections'] = {
  Hero: {
    schema: z.object({
      headline: z.string().default('Welcome'),
      subtitle: z.string().default(''),
    }),
    component: HeroBanner,
    description: 'Top hero banner. Edit headline/subtitle, or remove for a denser page.',
  },
};
```

> 🧩 Flat props, stable IDs, and how Claude discovers sections: **[Sections guide](sections.md)**.

## 3. Assemble the starting page (`initialConfig`)

A `PageConfig` is the typed JSON tree the whole system renders. Parse your theme through its schema so defaults populate:

```ts
// personalization/schemas.ts  (continued)
import type { PageConfig } from '@showcase/sdk/core';

export const initialConfig: PageConfig = {
  id: 'myapp',
  slug: 'myapp',                  // identifies this "page" to persistence
  theme: ThemeSchema.parse({}),   // Zod fills token/font defaults
  sections: [],                   // none yet
  filter: {},
  sort: {},
  meta: { title: 'My App', favicon: '/favicon.ico' },
};

export const promptHints = {
  role: 'personalization assistant for My App — concise, friendly',
  examples: ['"forest green theme" → update_theme'],
};
```

> 📐 The full `PageConfig` shape and how patches fold onto it: **[Concepts](concepts.md#pageconfig--the-page-as-data)**.

## 4. Create the host + mount the provider

`defineHost()` bundles your schemas, prompts, persistence, and key into one object the SDK consumes. Keep it in `personalization/host.ts` so client and server share it:

```ts
// personalization/host.ts
import { defineHost } from '@showcase/sdk/core';
import { localStoragePersistence } from '@showcase/sdk';
import { ThemeSchema, initialConfig, promptHints, sections } from './schemas';

export const host = defineHost({
  theme: { schema: ThemeSchema },
  sections,
  initialConfig,
  promptHints,
  persistence: localStoragePersistence({ namespace: 'myapp' }), // simplest durable option
  apiKey: '',  // the browser never needs it; the server route supplies the real one
});
```

> 💾 `localStoragePersistence` is the zero-config choice. For shared, cross-device, multi-mode persistence, swap in `supabasePersistence`. All options: **[Persistence guide](persistence.md)**.

Now wrap your app **once**. This is the only change to your top-level layout:

```tsx
// App.tsx  (or app/layout.tsx in Next.js)
import { PersonalizationRoot, ChatPanel } from '@showcase/sdk';
import { host } from './personalization/host';
import { fontCatalog } from './personalization/schemas';
import '@showcase/sdk/styles.css';

export default function App() {
  return (
    <PersonalizationRoot host={host} fontCatalog={fontCatalog}>
      <YourExistingApp />
      <ChatPanel host={host} pageSlug="myapp" apiUrl="/api/chat" />
    </PersonalizationRoot>
  );
}
```

`PersonalizationRoot` holds the live config, publishes theme tokens to CSS variables, injects the chosen Google Font, and exposes hooks. `ChatPanel` is the floating chat UI (with mode pills) — drop it anywhere inside the provider. → **[Chat Panel guide](chat-panel.md)**

## 5. Add the chat route

`<ChatPanel apiUrl="/api/chat">` POSTs here. The handler streams Claude's response and writes patches through your persistence.

**Next.js (App Router):**

```ts
// app/api/chat/route.ts
import { createNextHandler } from '@showcase/sdk/server';
import { host } from '@/personalization/host';

// Supply the real API key + (optionally) a server-side persistence adapter here.
export const { POST, runtime, dynamic } = createNextHandler({
  ...host,
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
```

**Any Web-standard server (Hono, Express-with-Request, etc.):**

```ts
import { createChatHandler } from '@showcase/sdk/server';
import { host } from './personalization/host';

const chat = createChatHandler({ ...host, apiKey: process.env.ANTHROPIC_API_KEY! });
app.post('/api/chat', (c) => chat(c.req.raw)); // pass it a Request, return its Response
```

> 🔌 Server-side persistence (Supabase), mode endpoints, and the streaming protocol: **[Server guide](server.md)**.

## 6. Read the live config in your components

Anywhere inside the provider, pull the current config (and dispatch your own patches if you want):

```tsx
import { useConfig } from '@showcase/sdk';

function Header() {
  const config = useConfig();
  return <h1>{config.meta.title}</h1>;   // re-renders when Claude edits it
}
```

## ✅ Try it

Run your app, open the chat panel, and type:

- _"dark theme"_ → tokens flip; CSS variables update everywhere.
- _"use a serif font"_ → the page font changes.
- _"make the accent forest green"_ → `--accent` updates live.

Reload — your changes are still there. 🎉

## Where to next

- **[Theme](theme.md)** — go beyond the 8 tokens: fonts, card presets, layout presets.
- **[Sections](sections.md)** — make regions of your page editable.
- **[Persistence](persistence.md)** — move from localStorage to shared, multi-mode Supabase storage.
- **[Concepts](concepts.md)** — how patches, the prompt cache, and the client/server boundary work under the hood.
