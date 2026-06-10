// Default media card presets. Each entry is a complete spec — no partials.
// Hosts can extend or replace via `defineCardPresets(overrides, {replace})`.
//
// Naming convention: snake_case archetype names. The shape of the card,
// not the kind of media — a podcast can use `square_card`, an album can
// use `audio_card`, etc. Hosts pick the closest archetype for their domain
// default and let visitor prompts swap.

import type { CardPresetCatalog } from './types';
import {
  VIDEO_CARD_LAYOUT,
  SQUARE_CARD_LAYOUT,
  SHORTS_CARD_LAYOUT,
  COMPACT_CARD_LAYOUT,
  POSTER_CARD_LAYOUT,
  AUDIO_CARD_LAYOUT,
  HORIZONTAL_ROW_LAYOUT,
} from './default-layouts';

export const DEFAULT_CARD_PRESETS: CardPresetCatalog = {
  // YouTube / standard video card. Cover on top, attribution + meta below.
  video_card: {
    aspect: '16:9',
    orientation: 'vertical',
    coverScale: 1,
    coverSaturate: 1,
    coverFit: 'cover',
    hoverEffect: 'lift',
    showDescription: false,
    showStats: true,
    showTimestamp: true,
    showDuration: true,
    hideMeta: false,
    description:
      'Standard video card. 16:9 cover on top, title + creator + stats ' +
      '+ timestamp below. The YouTube default — pick when "video", ' +
      '"watch", or "show me clips" comes up.',
    layout: VIDEO_CARD_LAYOUT,
  },


  // Instagram-style feed card. Square cover, minimal meta, image-first.
  square_card: {
    aspect: '1:1',
    orientation: 'vertical',
    coverScale: 1,
    coverSaturate: 1,
    coverFit: 'contain',
    hoverEffect: 'none',
    showDescription: false,
    showStats: false,
    showTimestamp: false,
    showDuration: false,
    hideMeta: true,
    description:
      'Square image-first card. 1:1 cover, title + subtitle below, no ' +
      'stats / timestamps. For "instagram feed" prompts ALWAYS pair with ' +
      'layoutPreset:"grid_oneCol" — a single column with square covers IS ' +
      'the Instagram aesthetic; just switching the card without the layout ' +
      'leaves you in a wide multi-col grid that feels nothing like ' +
      'Instagram. Other use cases: "photo grid", "minimal", any ' +
      'visual-dominant prompt.',
    layout: SQUARE_CARD_LAYOUT,
  },


  // Tall 9:16 cover for short-form vertical video (YouTube Shorts, TikTok,
  // Reels). Title sits beneath the cover; no other meta.
  shorts_card: {
    aspect: '9:16',
    orientation: 'vertical',
    coverScale: 1.05,
    coverSaturate: 1,
    coverFit: 'contain',
    hoverEffect: 'zoom',
    showDescription: false,
    showStats: false,
    showTimestamp: false,
    showDuration: false,
    hideMeta: true,
    description:
      'Tall 9:16 card for short-form vertical content (Shorts, TikTok, ' +
      'Reels). Cover-dominant with bold title underneath. Pick for ' +
      '"shorts", "vertical video", or "TikTok-style".',
    layout: SHORTS_CARD_LAYOUT,
  },


  // Dense compact card — tight grid, no meta line. For "show me more at once".
  compact_card: {
    aspect: '16:9',
    orientation: 'vertical',
    coverScale: 1,
    coverSaturate: 1,
    coverFit: 'cover',
    hoverEffect: 'none',
    showDescription: false,
    showStats: false,
    showTimestamp: false,
    showDuration: true,
    hideMeta: true,
    description:
      'Dense, compact 16:9 card. Title + duration only — no stats, no ' +
      'timestamp, no creator visible. Pick for "tighter", "more compact", ' +
      '"show more per row", "minimize whitespace".',
    layout: COMPACT_CARD_LAYOUT,
  },


  // Poster-shaped card (3:4) with prominent title. Magazine, books, films.
  poster_card: {
    aspect: '3:4',
    orientation: 'vertical',
    coverScale: 1.1,
    coverSaturate: 1,
    coverFit: 'contain',
    hoverEffect: 'lift',
    showDescription: false,
    showStats: false,
    showTimestamp: false,
    showDuration: false,
    hideMeta: false,
    description:
      'Tall 3:4 poster card with a heavy title beneath. Pick for ' +
      '"movie posters", "magazine", "editorial", "book covers", or ' +
      'any "tall portrait" style prompt.',
    layout: POSTER_CARD_LAYOUT,
  },


  // Square cover with a play-button overlay vibe — albums, podcasts,
  // audio-first content. Renderer pairs this with a play affordance.
  audio_card: {
    aspect: '1:1',
    orientation: 'vertical',
    coverScale: 1,
    coverSaturate: 1,
    coverFit: 'contain',
    hoverEffect: 'lift',
    showDescription: false,
    showStats: false,
    showTimestamp: false,
    showDuration: true,
    hideMeta: false,
    description:
      'Square audio/podcast/album card. 1:1 cover with title + artist/' +
      'show below, duration as a small badge. Pick for "album grid", ' +
      '"podcast episodes", "spotify-style", "music".',
    layout: AUDIO_CARD_LAYOUT,
  },


  // Horizontal layout — cover left, content right. Email-list / track-row vibe.
  horizontal_row: {
    aspect: '16:9',
    orientation: 'horizontal',
    coverScale: 1,
    coverSaturate: 1,
    coverFit: 'cover',
    hoverEffect: 'none',
    showDescription: true,
    showStats: true,
    showTimestamp: true,
    showDuration: true,
    hideMeta: false,
    description:
      'Horizontal row card. Small cover on the left, full meta + ' +
      'description on the right. Pick for "list view", "track list", ' +
      '"email-style", "playlist".',
    layout: HORIZONTAL_ROW_LAYOUT,
  },

};
