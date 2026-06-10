# Sections

A **section** is a region of your page that Claude can add, remove, reorder, or edit — a hero, a product grid, a notes pane, a video shelf. Sections are how personalization goes beyond theming into _structure_ and _content_.

Sections are **optional**: theme-only personalization works without any. Add them when you want chat to rearrange or populate the page.

> Real registries to copy: the [YouTube clone](../../../apps/web/lib/personalization.ts) wires 14 section types; the [Spotify clone](../../../spotify-react-web-client/src/personalization/schemas.ts) starts with zero and grows.

---

## Anatomy

Each section type is one entry in `host.sections` — a **schema** + a **component** + an optional **description**:

```ts
import { z } from 'zod';
import type { DefineHostInput } from '@showcase/sdk/core';
import { ProductGrid } from '../components/ProductGrid';

export const sections: DefineHostInput['sections'] = {
  ProductGrid: {
    // 1) Zod schema — the props Claude can edit. Keep them FLAT (see below).
    schema: z.object({
      columns: z.number().int().min(2).max(5).default(4),
      density: z.enum(['compact', 'cozy', 'comfortable']).default('cozy'),
      headline: z.string().default('Featured'),
    }),
    // 2) Your React component, rendered for each instance of this type.
    component: ProductGrid,
    // 3) A one-line hint shown to Claude so it knows when to use this section.
    description: 'Grid of product cards. Change column count, density, or headline.',
  },
};
```

A section **instance** inside your `PageConfig` is just:

```ts
{ id: 'productGrid', type: 'ProductGrid', props: { columns: 4, density: 'cozy', headline: 'Featured' } }
```

## The schema does triple duty

You write the Zod schema once; the SDK uses it for **three** things, so they can never drift:

1. **Tool inputs** — Claude's `update_section` / `add_section` calls are validated against it.
2. **The prompt catalog** — Claude learns the section exists and what it can change (your `description` + the field shapes).
3. **Defaults** — `add_section` materializes a fully-populated instance via the schema's `.default()`s, so Claude can say `add_section({ type: 'ProductGrid', props: {} })` and get a working section.

## Two rules that make personalization reliable

### ✅ Keep props flat

Claude edits `props.headline`, not `props.content.heading.text`. Shallow, well-named props are dramatically easier for the model to target correctly.

```ts
// 👍 do
z.object({ headline: z.string(), columns: z.number() })
// 👎 avoid
z.object({ content: z.object({ heading: z.object({ text: z.string() }) }) })
```

### ✅ Section IDs are stable

An instance's `id` is load-bearing — patches reference it across edits. **Never regenerate IDs.** Seed them as readable constants (`'productGrid'`, `'hero'`); `add_section` mints new ones, and the agent reads existing IDs from the page snapshot rather than inventing them.

## What Claude can do with sections

Derived automatically from your registry — no extra wiring:

| Tool | Effect |
|---|---|
| `update_section` | Patch one section's props (deep-merged; `null` deletes a key) |
| `add_section` | Insert a new instance (defaults materialized from schema) |
| `remove_section` | Drop a section ("hide the sidebar") |
| `reorder_sections` | Move sections around ("put reviews near the top") |

→ How these fold onto the page: **[Concepts → patches](concepts.md#patches--the-edit-unit)**.

## Rendering instances

Your component receives the props described by its schema. The SDK currently types `component` loosely (`ComponentType<any>`) because hosts use different conventions — the YouTube clone passes `{ section, config }`; the Spotify host passes schema-shaped props directly. Pick one convention for your app and stick to it. A typical render loop walks `config.sections` and looks up the component by `type`:

```tsx
import { useConfig } from '@showcase/sdk';

function Page() {
  const config = useConfig();
  return config.sections.map((s) => {
    const Entry = sections[s.type]?.component;
    return Entry ? <Entry key={s.id} section={s} config={config} /> : null;
  });
}
```

## See also

- **[Theme](theme.md)** — the other half of "what's editable."
- **[Chat Panel](chat-panel.md)** — handling custom tool calls (e.g. fetching more content) from a section.
- **[Concepts](concepts.md)** — `PageConfig`, patches, and the prompt model.
