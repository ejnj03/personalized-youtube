// Default layouts paired with each catalog preset. The agent can override
// any of these via theme.cardLayout; these are just the "what does this
// archetype look like out of the box" specs.
//
// Source values are the standard MediaItem field names. Hosts that pass
// extra fields (custom badges, etc.) extend their MediaItem interface and
// register the new keys in promptHints.

import type { CardLayout } from './layout-types';

/** YouTube / generic video card. Cover with duration badge, avatar+title
 *  row, then a creator + meta line. */
export const VIDEO_CARD_LAYOUT: CardLayout = {
  cover: { source: 'cover', fit: 'cover' },
  overlays: [
    { position: 'br', contents: { kind: 'badge', source: 'badge', color: 'neutral' } },
  ],
  below: [
    // Proper YouTube card: avatar on the LEFT, vertical stack of
    // [title, channel, stats·timestamp] on the RIGHT. The column inside
    // the row is what makes the right-side content stack tightly aligned
    // to the avatar instead of falling full-width below.
    {
      kind: 'row',
      gap: 12,
      align: 'start',
      children: [
        { kind: 'avatar', source: 'avatar', size: 'md', shape: 'circle' },
        {
          kind: 'column',
          gap: 4,
          children: [
            { kind: 'text', source: 'title',    weight: 500, size: 'sm', maxLines: 2 },
            { kind: 'text', source: 'subtitle', size: 'xs', color: 'mutedFg', maxLines: 1 },
            {
              kind: 'row',
              gap: 6,
              children: [
                { kind: 'text', source: 'stats',     size: 'xs', color: 'mutedFg' },
                { kind: 'text', source: 'timestamp', size: 'xs', color: 'mutedFg' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Instagram-style square card. Avatar+handle row ABOVE the cover, square
 *  image, caption below. */
export const SQUARE_CARD_LAYOUT: CardLayout = {
  above: [
    {
      kind: 'row',
      gap: 8,
      align: 'center',
      children: [
        { kind: 'avatar', source: 'avatar', size: 'sm', shape: 'circle' },
        { kind: 'text', source: 'subtitle', weight: 600, size: 'sm' },
      ],
    },
  ],
  cover: { source: 'cover', fit: 'cover' },
  below: [
    { kind: 'text', source: 'title', weight: 500, size: 'sm', maxLines: 2 },
  ],
};

/** Shorts / Reels / TikTok-style. Title is OVERLAID on the cover's bottom
 *  band with a gradient backing. Nothing below. */
export const SHORTS_CARD_LAYOUT: CardLayout = {
  cover: { source: 'cover', fit: 'cover' },
  overlays: [
    {
      position: 'bottomBand',
      gradient: true,
      contents: [
        { kind: 'text', source: 'title', weight: 700, size: 'lg', color: 'white', maxLines: 2 },
      ],
    },
  ],
};

/** Dense compact card — duration badge, then just a title below. */
export const COMPACT_CARD_LAYOUT: CardLayout = {
  cover: { source: 'cover', fit: 'cover' },
  overlays: [
    { position: 'br', contents: { kind: 'badge', source: 'badge', color: 'neutral' } },
  ],
  below: [
    { kind: 'text', source: 'title', weight: 500, size: 'sm', maxLines: 2 },
  ],
};

/** Poster-shaped card. Tall cover, bold title below, no other meta. */
export const POSTER_CARD_LAYOUT: CardLayout = {
  cover: { source: 'cover', fit: 'cover' },
  below: [
    { kind: 'text', source: 'title',    weight: 700, size: 'base', maxLines: 2 },
    { kind: 'text', source: 'subtitle', weight: 400, size: 'xs',   color: 'mutedFg' },
  ],
};

/** Spotify-style audio card. Square cover, title + subtitle (artist),
 *  duration badge for podcast episodes. */
export const AUDIO_CARD_LAYOUT: CardLayout = {
  cover: { source: 'cover', fit: 'cover' },
  overlays: [
    { position: 'br', contents: { kind: 'badge', source: 'badge', color: 'neutral' } },
  ],
  below: [
    { kind: 'text', source: 'title',    weight: 600, size: 'sm', maxLines: 2 },
    { kind: 'text', source: 'subtitle', weight: 400, size: 'xs', color: 'mutedFg' },
  ],
};

/** Horizontal row card. Small cover on the LEFT (via orientation:'horizontal'
 *  on the preset), full meta in the aside region on the right. */
export const HORIZONTAL_ROW_LAYOUT: CardLayout = {
  cover: { source: 'cover', fit: 'cover' },
  aside: [
    { kind: 'text', source: 'title',       weight: 500, size: 'base', maxLines: 2 },
    { kind: 'text', source: 'subtitle',    weight: 400, size: 'sm',   color: 'mutedFg' },
    {
      kind: 'row',
      gap: 6,
      children: [
        { kind: 'text', source: 'stats',     size: 'xs', color: 'mutedFg' },
        { kind: 'text', source: 'timestamp', size: 'xs', color: 'mutedFg' },
      ],
    },
    { kind: 'text', source: 'description', size: 'xs', color: 'mutedFg', maxLines: 2 },
  ],
};
