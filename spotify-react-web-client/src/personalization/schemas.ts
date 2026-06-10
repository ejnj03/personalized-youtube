/**
 * Single source of truth for the spotify host's personalization shape.
 *
 * Both the client host (src/personalization/host.ts) and the server host
 * (server/host.ts) import from here so the schema, initial config, prompt
 * hints, and section registry stay in lockstep. Only persistence + apiKey
 * differ between the two sides; those get added inside each host.ts.
 */

import { z } from 'zod';
import type { PageConfig, DefineHostInput } from '@showcase/sdk';

// ─── Theme schema ───
// Smallest theme that proves the SDK wiring: accent color + background `from`.
import {
  defineFonts,
  defineTokens,
  defineCardPresets,
  defineLayoutPresets,
  CardLayoutSchema,
  sourceRulesField,
  SourceScheduleSchema,
} from '@showcase/sdk';

// Generate both schema + catalog from one call. The catalog gets exported
// so App.tsx can pass it to <PersonalizationRoot>.
const fonts = defineFonts({
  'spotify-mix': {
    family: 'SpotifyMixUI',
    google: '',  // already loaded by @font-face in App.scss — skip Google Fonts
    description: 'Native spotify font. The brand-safe default for spotify aesthetics.',
    category: 'sans',
  },
}, { defaultKey: 'spotify-mix' });

export const fontCatalog = fonts.catalog;

// Card preset catalog — uses the SDK defaults (audio_card / square_card /
// horizontal_row are the spotify-relevant ones). Hosts can extend later;
// for now the SDK's vocabulary is enough.
const cards = defineCardPresets({}, { defaultKey: 'audio_card' });
export const cardPresetCatalog = cards.catalog;

// Layout preset catalog — controls how the home page rows arrange their
// cards. Default 'row_scroll' matches Spotify's existing horizontal-scroll
// rows; visitors can flip to grid_oneCol / grid_compact / etc. for an
// "instagram feed"-style reshape.
const layouts = defineLayoutPresets({}, { defaultKey: 'row_scroll' });
export const layoutPresetCatalog = layouts.catalog;

export const ThemeSchema = z.object({
  tokens: defineTokens({
    bg:        '#121212',   // spotify's page dark
    fg:        '#ffffff',   // primary text
    surface:   '#1f1f1f',   // top bar / playing bar / cards
    muted:     '#282828',   // hover states, dropdowns
    mutedFg:   '#b3b3b3',   // secondary text
    border:    '#2a2a2a',   // dividers
    accent:    '#1db954',   // spotify green
    accentFg:  '#000000',   // text on green buttons
  }),
  fontFamily: fonts.schema,
  background: z.object({ kind: z.enum(['solid','gradient','sampled']) }).optional(),
  // Media card presentation. Visitor prompts change this to reshape every
  // GridCards-backed section (NewReleases, MadeForYou, FeaturePlaylists,
  // etc.) at once. `cardOverrides` is the per-field escape hatch.
  cardPreset: cards.schema.catch('audio_card'),
  cardOverrides: cards.overrideSchema,
  layoutPreset: layouts.schema.catch('row_scroll'),
  // Custom slot-tree layout. Set by the agent when the visitor asks for
  // rearrangements ("instagram-style with artist above the cover", etc.).
  cardLayout: CardLayoutSchema.optional(),
  // Persistent lyric-translation language for this mode. Read by LyricsView.
  captionLang: z
    .string()
    .optional()
    .describe(
      'Persistent lyric-translation language for songs in this mode. Set to a language code (en, ko, ja, es, fr, zh) when the visitor says "translate songs to X", "always show subtitles/lyrics in X", or "show english translations". Every song then shows a color-coded translation of its lyrics into that language (words already in that language are highlighted). Set "" to turn it off.',
    ),
});

export type SpotifyTheme = z.infer<typeof ThemeSchema>;

// ─── CuratedRow section ───
// A home row whose tracks come from curated SourceRules: each rule searches
// Spotify for tracks by query, optionally narrowed by title tags and gated to a
// local time window. The LLM edits props.sources; the Spotify home renders it
// natively (CuratedRow.tsx) via the SDK useSourceRules hook — no LLM call to
// apply, windows flip on their own.
export const CuratedRowSchema = z.object({
  title: z.string().default('On a schedule').describe('Heading shown above the curated row.'),
  sources: sourceRulesField(
    'Curated music rules for this row — each searches Spotify for tracks by query, optionally narrowed by title tags and gated to a local time window. Use this (NOT a one-off fetch) for PERSISTENT/scheduled requests like "only classical piano from 8–10am".',
  ),
  schedule: SourceScheduleSchema.optional().describe(
    'Default time window applied to any rule that has no schedule of its own.',
  ),
});

// ─── Initial config ───
export const initialConfig: PageConfig = {
  id: 'spotify',
  slug: 'spotify',
  theme: ThemeSchema.parse({}),                            // Zod fills defaults
  // One empty CuratedRow exists by default so the home always has the row; the
  // LLM fills its `sources` on request. Stable id so patches survive reloads.
  sections: [
    { id: 'curatedRow', type: 'CuratedRow', props: CuratedRowSchema.parse({}) },
  ],
  filter: {},
  sort: {},
  meta: { title: 'Spotify', favicon: '/favicon.ico' },
};

// ─── Section registry ───
// CuratedRow only — Spotify's other content stays native (real Spotify API).
// The component is a no-op stub here because the Spotify home renders CuratedRow
// itself (reading config.sections); the registry entry exists so the LLM gets
// the schema (props.sources) + can add/edit/remove the section.
export const sections: DefineHostInput['sections'] = {
  CuratedRow: {
    schema: CuratedRowSchema,
    component: () => null,
    description:
      'A home row of tracks curated by search rules. Each rule fills the row from a Spotify search query, optionally narrowed by title tags and gated to a local time window. Edit props.sources to add/modify/remove rules for persistent/scheduled requests.',
  },
};

// ─── Prompt hints ───
// Domain context injected into Claude's system prompt.
export const promptHints: DefineHostInput['promptHints'] = {
  role: 'personalization assistant for a Spotify clone — playlists, albums, top tracks; music-fan vocabulary',
  examples: [
    '"forest green theme" → update_theme({ accent: "#22C55E" })',
    '"instagram feed" / "single column" / "stack vertically" → update_theme({ cardPreset: "square_card", layoutPreset: "grid_oneCol" }) — ALWAYS set BOTH; cardPreset alone leaves the grid wide and multi-col.',
    '"as posters" / "tall cards" → update_theme({ cardPreset: "poster_card" })',
    '"tighter rows" → update_theme({ layoutPreset: "row_dense" })',
    '"as a grid not a row" → update_theme({ layoutPreset: "grid_default" })',
    '"vintage / muted covers" → update_theme({ cardOverrides: { coverSaturate: 0.4 } })',
    // PERSISTENT lyric-translation preference (applies to every song in the mode).
    '"translate songs to english" / "always show english subtitles" / "show me korean lyrics in english" → update_theme({ captionLang: "en" }); "turn off translations" → update_theme({ captionLang: "" })',
    // PERSISTENT / scheduled topic rules → write them onto the CuratedRow so
    // they re-apply with no further LLM call. CURATE several concrete queries +
    // named artists/albums (don\'t pass one vague term). Read props.sources first.
    '"only classical piano from 8 to 10:30am" → update_section on the CuratedRow: props.sources = [{ queries: ["classical piano", "piano nocturne", "solo piano study"], creators: ["Bill Evans", "Ludovico Einaudi", "Chopin"], schedule: { start: "08:00", end: "10:30" } }] (start/end are 24h "HH:MM" local, minute precision)',
    '"always show lo-fi beats in that row" → update_section: props.sources = [{ queries: ["lo-fi beats", "lofi hip hop study"], creators: ["Nujabes", "idealism"] }] (no schedule = always)',
  ],
};
