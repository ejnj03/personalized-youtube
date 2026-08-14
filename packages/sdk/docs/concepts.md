# Concepts

The mental model behind the SDK. You can build a host without reading this — but it's the page to open when you hit "wait, *why* does it work that way?"

- [PageConfig — the page as data](#pageconfig--the-page-as-data)
- [Patches — the edit unit](#patches--the-edit-unit)
- [Schemas derive everything](#schemas-derive-everything)
- [The prompt cache](#the-prompt-cache)
- [The client / server boundary](#the-client--server-boundary)

---

## PageConfig — the page as data

The entire personalized page is one typed JSON tree, the `PageConfig`:

```ts
interface PageConfig {
  id: string;
  slug: string;          // identifies this page to persistence
  theme: { /* your ThemeSchema — tokens, fonts, presets */ };
  sections: Section[];   // ordered; each { id, type, props }
  filter: { /* host-defined */ };
  sort: { /* host-defined */ };
  meta: { title: string; favicon: string };
}
```

The rendered page is a **pure function of this config**. `<PersonalizationRoot>` holds the current `PageConfig`; your components read it (via `useConfig()`); when it changes, they re-render. Nothing personalizes the DOM directly — everything flows through the config. That's what makes changes reload-safe and undoable.

## Patches — the edit unit

Claude never rewrites the whole page. It emits small **patches** — one per tool call — that fold onto the current config:

| Patch op | Tool | Effect |
|---|---|---|
| `update_theme` | `update_theme` | deep-merge into `theme` |
| `update_section` | `update_section` | deep-merge into one section's `props` |
| `set_filter` / `set_sort` | `set_filter` / `set_sort` | merge into `filter` / `sort` |
| `add_section` | `add_section` | insert a new section (defaults materialized) |
| `remove_section` | `remove_section` | drop a section by id |
| `reorder_sections` | `reorder_sections` | change section order |

`applyPatch(config, patch)` and `applyPatches(config, patches)` do the folding (importable from `@showcase/sdk/core`). Merges are deep; a `null` value **deletes** a key. The rendered state is always `applyPatches(baseConfig, allStoredPatches)` — so persistence only stores the patches, and replaying them reconstructs the page.

This is why a returning visitor lands on their personalized view: load the base config, fold their stored patches, render.

## Schemas derive everything

You define a `ThemeSchema` and a few section schemas (Zod). From those, `defineHost()` derives — at startup — **all three** of the things that usually drift apart:

```
your Zod schemas ──┬──▶ Anthropic tool definitions   (what Claude can call)
                   ├──▶ the prompt's schema catalog  (what Claude knows exists)
                   └──▶ runtime validators           (what's allowed at the API boundary)
```

Add a theme token or a section prop, and Claude can use it immediately — no separate tool definition, no prompt edit, no validator. The `.describe()` text on your schema fields is what teaches Claude *when* to use each knob, so it's worth writing well. → **[Theme](theme.md)**, **[Sections](sections.md)**.

## The prompt cache

Chat calls are structured so [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) does most of the work. The system prompt is built in stable-to-volatile order so the expensive prefix is reused across requests:

1. **Role + tool definitions** — stable across everyone.
2. **Schema catalog** — changes only when you change a schema.
3. **Editing rules + few-shots** — changes only when you change `promptHints`.
4. **Per-visitor state** — the current page snapshot + recent preferences (not cacheable across visitors).

Anything appended *before* segment 4 busts the cache for everyone, so the SDK keeps per-visitor state last. The practical effect: the first request warms the cache (~a few seconds); subsequent requests are fast and cheap. The pieces are exposed as `buildSystemBlocks` / `buildVisitorState` if you ever build a custom handler.

## The client / server boundary

The package ships separate entry points because of how React Server Components treat the `'use client'` directive:

- `@showcase/sdk` (the **root barrel**) bundles the client components — `ChatPanel`, `PersonalizationRoot` — so it carries a hoisted `'use client'`. Importing **anything** from it into a server-evaluated module marks that module as client; *calling* a function from it on the server throws _"called from the server."_
- `@showcase/sdk/core` is **directive-free**. The host builders (`defineHost`, `defineTokens`, `defineFonts`, `defineCardPresets`, …) and the patch model live here, safe to evaluate on the server.
- `@showcase/sdk/server` holds the route handlers; `@showcase/sdk/sqlite` and `@showcase/sdk/supabase` hold the two server-only persistence adapters.

**The rule:** any module that runs (or might run) on the server — a Next.js RSC, a route handler, or a **schema imported by one** — must import builders from `@showcase/sdk/core`. Mount components and hooks (`PersonalizationRoot`, `ChatPanel`, `useConfig`) come from `@showcase/sdk` and are only ever used in client components.

```ts
// personalization/schemas.ts  — imported by both client AND a server route
import { defineTokens, defineFonts } from '@showcase/sdk/core';   // ✅ server-safe
// import { defineTokens } from '@showcase/sdk';                  // ❌ throws in RSC
```

In a pure SPA (no RSC, like the Spotify clone) there's no boundary, so the root barrel works everywhere — but importing builders from `/core` anyway keeps a host portable to Next.js later.

→ The import-path cheat sheet lives in **[Server](server.md#import-path-checklist)**.

## See also

- **[Getting Started](getting-started.md)** — these concepts in practice.
- **[Theme](theme.md)** / **[Sections](sections.md)** — the two schema surfaces you author.
- **[Server](server.md)** — where patches get produced and persisted.
