import { z } from 'zod';
// Import from the server-safe core entry, NOT the root '@showcase/sdk' barrel:
// this schema is parsed in RSC/server contexts (lib/queries/page.ts), and the
// root barrel carries a hoisted 'use client' (it bundles ChatPanel etc.), so
// calling defineTokens/defineFonts from it throws "called from the server".
import {
  defineTokens,
  defineFonts,
  defineCardPresets,
  defineLayoutPresets,
} from '@showcase/sdk/core';
import { CardLayoutSchema } from '@showcase/sdk/core';

const HEX = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const BackgroundSchema = z
  .object({
    // 'solid' / 'gradient' set the bg via from/to/angle.
    // 'paper'  — cream texture preset (bookshop / quiet aesthetic).
    // 'sampled'— colors extracted from a content source (the watch page's
    //            playing video thumbnail). Renders as a soft radial blob bg
    //            and is animated when the source changes.
    kind: z.enum(['solid', 'gradient', 'paper', 'sampled']).default('solid'),
    from: HEX.optional(),
    to: HEX.optional(),
    angle: z.number().int().min(0).max(360).default(180),
    // Source for kind='sampled'. 'playingVideo' uses the watch-page video.
    sampleSource: z.enum(['playingVideo', 'topVideo']).optional(),
    // Sampled-bg intensity, 0..1. Default 0.7 reads as ambient, not casino.
    intensity: z.number().min(0).max(1).default(0.7),
  })
  .default({ kind: 'solid', angle: 180, intensity: 0.7 });
export type Background = z.infer<typeof BackgroundSchema>;

// Font vocabulary now comes straight from the SDK's catalog (defineFonts).
// The YT clone's selectable keys are exactly the 24 DEFAULT_FONTS keys, so we
// take the default catalog as-is — no `replace`, no host extras to merge.
// `.catch('inter')` keeps old/stale saved values (the dropped 'sans'/'serif'/
// 'mono'/'rounded' aliases) validating by coercing them to the default instead
// of throwing. next/font remains the loader (app/fonts.ts) and PageRoot's
// FONT_CLASS maps these keys → Tailwind utilities, so we don't pass the
// catalog to <PersonalizationRoot> (no Google <link> injection, no double-load).
const fonts = defineFonts({}, { defaultKey: 'inter' });
export const fontCatalog = fonts.catalog;
const fontFamily = fonts.schema.catch('inter');

// Card presets + override hatch + layout presets. Same SDK pattern as fonts —
// the catalog is exported so renderers can resolve at render time.
const cards = defineCardPresets({}, { defaultKey: 'video_card' });
export const cardPresetCatalog = cards.catalog;
const cardPreset = cards.schema.catch('video_card');
const cardOverrides = cards.overrideSchema;

const layouts = defineLayoutPresets({}, { defaultKey: 'grid_default' });
export const layoutPresetCatalog = layouts.catalog;
const layoutPreset = layouts.schema.catch('grid_default');

export const ThemeSchema = z.object({
  // The 8 universal color tokens are the SOLE source of truth for the palette.
  // <PersonalizationRoot> publishes each to a CSS var on <html> (bg → --bg,
  // mutedFg → --muted-fg, …). Defaults below mirror the clone's light palette
  // in app/globals.css :root, so first paint is unchanged. "Dark mode" is now
  // just a chat-driven token swap rather than a separate `mode` flag.
  tokens: defineTokens({
    bg: '#ffffff',
    fg: '#0f0f0f',
    surface: '#ffffff',
    muted: '#f2f2f2',
    mutedFg: '#606060',
    border: '#e5e5e5',
    accent: '#FF0000',
    accentFg: '#ffffff',
  }),
  fontScale: z.enum(['0.875', '1', '1.125', '1.25']).default('1'),
  fontFamily,
  radius: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('md'),
  background: BackgroundSchema,
  // Media card presentation — preset (named archetype) + optional per-field
  // override hatch. Single source of truth for what every card looks like.
  cardPreset,
  cardOverrides,
  // Collection arrangement — preset only (no override hatch).
  layoutPreset,
  // Custom slot-tree layout — when set, MediaCard renders this instead of
  // the preset's default layout. The agent emits this for "rearrange ...",
  // "instagram-style", "show as ..." prompts that move parts of the card
  // around. Optional — falls back to preset.layout or the legacy fixed
  // render when absent.
  cardLayout: CardLayoutSchema.optional(),
  // 0..1 — dims TopBar + Sidebar so they recede when an ambient bg is
  // doing the talking. 0 = full-strength chrome; 0.5 = noticeably faded.
  chromeDim: z.number().min(0).max(1).default(0),
  // 0..1 — global film grain overlay on the page (looks great with sampled
  // backgrounds). 0 = off (default); 0.18 is the "filmic" sweet spot.
  grain: z.number().min(0).max(1).default(0),
});
export type Theme = z.infer<typeof ThemeSchema>;
