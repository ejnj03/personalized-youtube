// Media-agnostic vocabulary for a "media card" — a single presentation unit
// in a content collection (a video, a song, an episode, an album, a book).
// Hosts map their domain shape into these slots via a renderer; the preset
// only describes presentation (sizing, weights, what's visible), never data.

export type CardAspect = '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
export type CardOrientation = 'vertical' | 'horizontal';
export type HoverEffect = 'none' | 'lift' | 'zoom';

/**
 * Complete presentation spec for a single card. Every preset entry carries
 * the full set — there are no partial presets. Per-field nudges happen via
 * `cardOverrides: Partial<CardPreset>` on the theme.
 */
export interface CardPreset {
  /** Cover-image aspect ratio (cover = thumbnail / album art / book cover). */
  aspect: CardAspect;
  /** Vertical = cover on top, meta below. Horizontal = cover left, meta right. */
  orientation: CardOrientation;
  /** Cover scale factor (1 = base). Larger values blow the image up; useful
   *  for "make thumbnails bigger" prompts. */
  coverScale: number;
  /** CSS `filter: saturate()` on the cover. 1 = unchanged, <1 desaturates
   *  ("soft" / "vintage"), >1 boosts saturation. */
  coverSaturate: number;
  /** How the cover image fits its aspect-ratio frame:
   *  - 'cover'   — fill the frame, crop overflow (the YouTube default look).
   *  - 'contain' — letterbox: scale image to fit fully, pad the leftover
   *                space with the card's background color. Right choice
   *                when the card aspect doesn't match the source image
   *                aspect (e.g. 1:1 cards rendering 16:9 video thumbs). */
  coverFit: 'cover' | 'contain';
  /** Hover micro-interaction on the card. */
  hoverEffect: HoverEffect;
  /** Default slot-tree layout for this archetype. When the agent sets
   *  `theme.cardLayout`, that wins; otherwise the preset's layout renders.
   *  Optional so legacy / minimal presets can stay slotless and fall back
   *  to the fixed render in MediaCard. */
  layout?: import('./layout-types').CardLayout;
  /** Show a long-form description beneath the meta line. */
  showDescription: boolean;
  /** Show the primary engagement metric (views / plays / listens / reads). */
  showStats: boolean;
  /** Show the publish/release/upload timestamp ("2 days ago"). */
  showTimestamp: boolean;
  /** Show the duration badge on the cover ("13:56", "3:24"). */
  showDuration: boolean;
  /** Master toggle: hide the entire meta line (stats + timestamp + dot
   *  separators). Lets a single boolean give the bookshop / poster look. */
  hideMeta: boolean;
  /** Human-readable summary — used in Claude's tool prompt so it can pick by
   *  vibe ("instagram-style", "podcast list") rather than tweaking fields. */
  description: string;
}

export type CardPresetCatalog = Record<string, CardPreset>;
