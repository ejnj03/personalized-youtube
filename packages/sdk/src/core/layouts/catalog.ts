// Default collection layouts. Hosts can extend or replace via
// `defineLayoutPresets(overrides, {replace})`.

import type { LayoutPresetCatalog } from './types';

export const DEFAULT_LAYOUT_PRESETS: LayoutPresetCatalog = {
  // Standard YouTube grid — 3–4 columns at desktop, comfortable gap.
  grid_default: {
    kind: 'grid',
    columns: 4,
    gap: 24,
    scrollSnap: false,
    description:
      'Standard grid, 4 columns at desktop, comfortable gap. The default ' +
      'for any "show me a feed" or "homepage" intent.',
  },

  // Single-column for "instagram feed" + similar requests. Capped at
  // ~600px so each card stays sanely sized on desktop (mirrors Instagram's
  // and Twitter's actual feed widths).
  grid_oneCol: {
    kind: 'grid',
    columns: 1,
    gap: 16,
    scrollSnap: false,
    maxWidth: 600,
    description:
      'Single column down the page, capped at ~600px and centered (the ' +
      'real Instagram / Twitter feed width). Pick for "one column", ' +
      '"stack vertically", "single column feed", or pair with ' +
      'square_card for an "instagram feed" look.',
  },

  // Two-column variation. Also capped — 2 columns × full-bleed at desktop
  // makes each card 600px+ which feels oversized for browsing.
  grid_twoCol: {
    kind: 'grid',
    columns: 2,
    gap: 24,
    scrollSnap: false,
    maxWidth: 960,
    description: 'Two columns, capped at ~960px and centered. Pick for "2 across", "side by side", "pinterest-ish".',
  },

  // Tight 5-column grid for browsing-heavy "show me more at once" intents.
  grid_compact: {
    kind: 'grid',
    columns: 5,
    gap: 12,
    scrollSnap: false,
    description:
      'Dense 5-column grid with a small gap. Pick for "more per row", ' +
      '"compact", "browse-mode", "show me more at once".',
  },

  // Default horizontal row — Netflix / YouTube category style.
  row_scroll: {
    kind: 'row',
    columns: 5,
    gap: 16,
    scrollSnap: true,
    description:
      'Horizontal scrollable row with snap. ~5 cards visible at a time. ' +
      'Pick for "category row", "carousel", or any "scroll horizontally" ' +
      'intent.',
  },

  // Denser row — more cards visible, no snap.
  row_dense: {
    kind: 'row',
    columns: 7,
    gap: 8,
    scrollSnap: false,
    description:
      'Tight horizontal row, ~7 cards visible, smaller gap, no snap. ' +
      'Pick for "tighter row", "show more at once", "dense row".',
  },

  // Editorial 2-column with alternating heights — magazine vibe.
  magazine: {
    kind: 'magazine',
    columns: 2,
    gap: 32,
    scrollSnap: false,
    description:
      'Two-column magazine layout with alternating card heights. Pick ' +
      'for "editorial", "magazine", "essay-style", "long-form blog".',
  },
};
