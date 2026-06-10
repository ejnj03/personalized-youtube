# Theme

Theming in the SDK is **data, not CSS**. You declare a small, typed vocabulary — colors, a font, card and layout presets — and Claude edits it from chat. The SDK publishes the result to CSS variables your components already read.

This guide covers the four building blocks, all composed into your `ThemeSchema`:

1. [Color tokens](#1-color-tokens-definetokens) — the 8-color palette
2. [Fonts](#2-fonts-definefonts) — a curated, self-describing font catalog
3. [Card presets](#3-card-presets-definecardpresets) — how media cards look _(optional)_
4. [Layout presets](#4-layout-presets-definelayoutpresets) — how collections arrange _(optional)_

> 🔑 **Always import these builders from `@showcase/sdk/core`.** Your theme schema is parsed on the server (and in any SSR/RSC render), and the root `@showcase/sdk` barrel carries a hoisted `'use client'`. Importing from `/core` keeps it server-safe. → **[Concepts → the boundary](concepts.md#the-client--server-boundary)**

A complete `ThemeSchema` looks like this — see the [YouTube clone's theme](../../shared/src/schemas/theme.ts) for a production example:

```ts
import { z } from 'zod';
import { defineTokens, defineFonts, defineCardPresets, defineLayoutPresets } from '@showcase/sdk/core';

const fonts   = defineFonts({}, { defaultKey: 'inter' });
const cards   = defineCardPresets({}, { defaultKey: 'video_card' });
const layouts = defineLayoutPresets({}, { defaultKey: 'grid_default' });

export const fontCatalog = fonts.catalog;        // → pass to <PersonalizationRoot fontCatalog={…}>
export const cardPresetCatalog = cards.catalog;  // → renderers resolve presets at render time

export const ThemeSchema = z.object({
  tokens: defineTokens({ /* your brand palette */ }),
  fontFamily: fonts.schema,
  cardPreset: cards.schema,
  cardOverrides: cards.overrideSchema,   // optional per-field tweaks
  layoutPreset: layouts.schema,
});
```

---

## 1. Color tokens (`defineTokens`)

Eight universal tokens cover any UI. They're the **sole source of truth** for the palette:

| Token | CSS variable | What it paints |
|---|---|---|
| `bg` | `--bg` | Page background |
| `fg` | `--fg` | Primary text on `bg` |
| `surface` | `--surface` | Cards, panels, elevated chrome |
| `muted` | `--muted` | Chips, hovers, dividers |
| `mutedFg` | `--muted-fg` | Secondary text, timestamps |
| `border` | `--border` | Dividers, input edges |
| `accent` | `--accent` | Brand color, CTAs, active states |
| `accentFg` | `--accent-fg` | Text on `accent` |

### Declaring your palette

`defineTokens(overrides)` bakes your brand values in as the **per-field defaults**:

```ts
tokens: defineTokens({
  bg: '#121212', fg: '#ffffff',
  surface: '#1f1f1f', muted: '#282828', mutedFg: '#b3b3b3',
  border: '#2a2a2a',
  accent: '#1db954', accentFg: '#000000',   // Spotify green 💚
})
```

> **Why a factory, not `.default({...})`?** When chat sends a partial patch like `{ tokens: { bg: '#ff66cc' } }`, the _other_ tokens re-default from their per-field defaults. If those defaults were the SDK's neutral palette, your brand would collapse on every single-token edit. `defineTokens` bakes your values into each field, so partial updates preserve your palette.

### How they reach the screen

`<PersonalizationRoot>` writes every token to `<html>` as a CSS variable (`mutedFg → --muted-fg`) whenever `config.theme.tokens` changes. Your components — and your stylesheet — just read them:

```tsx
<div style={{ background: 'var(--surface)', color: 'var(--fg)', borderColor: 'var(--border)' }} />
```

For JSX that needs the values as strings (gradients, computed backgrounds), the `TOKEN` helper mirrors them:

```ts
import { TOKEN } from '@showcase/sdk/core';
<div style={{ background: `linear-gradient(180deg, ${TOKEN.bg}, ${TOKEN.muted})` }} />
```

> 💡 **No more `mode: 'light' | 'dark'`.** Dark mode is just a different set of token values — chat (or you) swaps them. Put your default palette in `defineTokens(...)` **and** as the `:root` fallback in your global CSS so the first server-rendered paint matches before hydration.

### Teaching Claude

Each token carries a `.describe()` that's surfaced to Claude in the prompt — it's the single biggest lever on picking the right token for an ambiguous request ("make it cozier" → `bg`/`muted`, "make X pop" → `accent`). The defaults are sensible; override them only if your domain needs different language.

---

## 2. Fonts (`defineFonts`)

`defineFonts(overrides, options)` returns `{ schema, catalog }`:

- **`schema`** — a `z.enum` of catalog keys, with each font's _vibe_ in its description so Claude can pick by mood. Put it on `theme.fontFamily`.
- **`catalog`** — the resolved font set. Pass it to `<PersonalizationRoot fontCatalog={…}>`.

```ts
const fonts = defineFonts(
  {
    // extend the 24-font default catalog with your own:
    brand: { family: 'My Brand Sans', google: 'My+Brand+Sans:wght@400;700',
             description: 'House font — the safe default.', category: 'sans' },
  },
  { defaultKey: 'brand' },   // which key is active before any edit
);
export const fontCatalog = fonts.catalog;
```

Options:

| Option | Effect |
|---|---|
| `defaultKey` | The active font when no patch has set one. Defaults to `'inter'`. |
| `replace: true` | Replace the [24-font default catalog](#) entirely instead of merging into it. |

### How fonts get loaded

When you pass `fontCatalog` to the provider, it **injects the Google Fonts `<link>`** and sets `--font-family` on `<html>` whenever `theme.fontFamily` changes. Your page font then follows:

```css
body { font-family: var(--font-family); }
```

> ⚙️ **Already using a build-time loader** (e.g. Next's `next/font`)? Then you _don't_ want the SDK injecting Google `<link>`s and double-loading. Use `defineFonts().schema` for the **vocabulary** (so Claude knows your fonts), keep your own loader, map the keys to your font classes, and simply **don't pass `fontCatalog`** to the provider. The YouTube clone does exactly this — see its [`theme.ts`](../../shared/src/schemas/theme.ts) and `app/fonts.ts`.

Helpers if you build your own font plumbing: `buildFontStack(entry)` (a `font-family` stack with language fallbacks) and `buildGoogleFontsUrl(catalog)` (the `<link>` URL). Both exported from `@showcase/sdk/core`.

---

## 3. Card presets (`defineCardPresets`)

> **Optional.** Skip this if your app has no repeated media cards.

A card preset is a named archetype for how a media card looks — aspect ratio, orientation, hover effect, which bits show. `defineCardPresets(overrides, options)` returns `{ schema, catalog, overrideSchema }`:

```ts
const cards = defineCardPresets({}, { defaultKey: 'video_card' });

export const ThemeSchema = z.object({
  // …
  cardPreset: cards.schema,             // a named preset (video_card, square_card, poster_card, …)
  cardOverrides: cards.overrideSchema,  // per-field escape hatch (e.g. just bump the title weight)
});
export const cardPresetCatalog = cards.catalog;
```

Resolve at render time with `resolveCardPreset(catalog, presetKey, overrides)` and `aspectRatioCss(aspect)`. Built-in archetypes are exported too (`VIDEO_CARD_LAYOUT`, `SQUARE_CARD_LAYOUT`, `POSTER_CARD_LAYOUT`, `AUDIO_CARD_LAYOUT`, …).

For free-form rearrangements ("instagram-style", "move the title above the thumbnail"), the schema includes an optional **`CardLayoutSchema`** slot-tree the agent can emit. That's an advanced surface — start with presets + overrides.

---

## 4. Layout presets (`defineLayoutPresets`)

> **Optional.** How a _collection_ of cards arranges — grid, list, carousel, masonry…

```ts
const layouts = defineLayoutPresets({}, { defaultKey: 'grid_default' });
export const ThemeSchema = z.object({
  // …
  layoutPreset: layouts.schema,   // preset only — no override hatch
});
export const layoutPresetCatalog = layouts.catalog;
```

Resolve with `resolveLayoutPreset(catalog, key)`. Defaults live in `DEFAULT_LAYOUT_PRESETS`.

---

## How the theme is edited

You don't write a "theme tool." `defineHost()` derives the `update_theme` tool and the prompt catalog **from your `ThemeSchema`** — including every `.describe()` you wrote. So adding a theme knob is a one-line schema change, and Claude can use it immediately:

- _"forest green dark theme"_ → `update_theme({ tokens: { bg: '#0d1f17', accent: '#1db954', … } })`
- _"use a serif font"_ → `update_theme({ fontFamily: 'newsreader' })`
- _"make the cards square"_ → `update_theme({ cardPreset: 'square_card' })`

→ Editing mechanics, patch folding, and the prompt cache: **[Concepts](concepts.md)**.

## See also

- **[Getting Started](getting-started.md)** — where the theme fits in the overall setup.
- **[Sections](sections.md)** — the _other_ half of "what's editable."
- **[Concepts](concepts.md#the-client--server-boundary)** — why theme builders import from `/core`.
