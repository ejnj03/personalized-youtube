// CardLayout — a bounded grammar the agent can emit to rearrange the parts
// of a media card. Three principles:
//   1. The grammar is small (~5 node kinds, ~7 overlay positions). Total
//      vocabulary is enumerable in the cached system prompt.
//   2. Slot `source` values are flat strings keyed against the host's
//      MediaItem (e.g. 'title', 'channelAvatar'). No dot paths.
//   3. Hosts never write CSS. The renderer walks the tree.
//
// Catalog presets ship a default layout. Visitors can override the whole
// layout via theme.cardLayout — the agent emits a fresh tree.

import type { CardAspect } from './types';

export type SlotTextSize = 'xs' | 'sm' | 'base' | 'lg';
export type SlotTextColor = 'inherit' | 'white' | 'accent' | 'mutedFg';
export type SlotAvatarSize = 'sm' | 'md' | 'lg';
export type SlotAvatarShape = 'circle' | 'square';
export type SlotBadgeColor = 'accent' | 'neutral' | 'live';
export type SlotRowAlign = 'start' | 'center';

/** A piece of content placed in a slot. The agent composes these. */
export type SlotNode =
  | {
      kind: 'text';
      /** Flat key on the host's MediaItem (e.g. 'title', 'subtitle', 'stats'). */
      source: string;
      weight?: number;
      size?: SlotTextSize;
      /** Color reference — keeps the agent away from raw hex. */
      color?: SlotTextColor;
      maxLines?: 1 | 2 | 3;
    }
  | {
      kind: 'avatar';
      /** Flat key on MediaItem pointing at an image URL. */
      source: string;
      size?: SlotAvatarSize;
      shape?: SlotAvatarShape;
    }
  | {
      kind: 'badge';
      source: string;
      color?: SlotBadgeColor;
    }
  | {
      kind: 'row';
      /** Children of a row are themselves slot nodes. Depth-2 max in practice
       *  (a row inside a row inside a row reads weirdly anyway). */
      children: SlotNode[];
      gap?: number;
      align?: SlotRowAlign;
    }
  | {
      /** Vertical stack — natural sibling to `row`. Lets you express a row
       *  with an avatar on the left and a stacked title/channel/meta on the
       *  right (the real YouTube card shape). Like row, children must be
       *  leaves (text/avatar/badge/row) to keep depth bounded. */
      kind: 'column';
      children: SlotNode[];
      gap?: number;
    };

/** Overlays sit on top of the cover image. Corners are small badges;
 *  bands span the full width of the cover (Shorts / Reels / movie posters). */
export type OverlayPosition =
  | 'tl' | 'tr' | 'bl' | 'br'    // corners — small badges
  | 'center'                       // single icon/button
  | 'topBand' | 'bottomBand';      // full-width strip

export interface OverlayNode {
  position: OverlayPosition;
  contents: SlotNode | SlotNode[];
  /** Fade behind the contents so overlaid text is readable on the image.
   *  Defaults to true for bands, false for corners + center. */
  gradient?: boolean;
}

/** The cover image itself. Optional because a "no-cover" card is valid. */
export interface CoverNode {
  source: string;
  fit?: 'cover' | 'contain';
  aspect?: CardAspect;  // overrides preset.aspect if present
}

/** Full card layout. Each region is an ordered list of slot nodes; the
 *  renderer stacks them vertically (above/below) or to the side (aside). */
export interface CardLayout {
  /** Nodes rendered above the cover (e.g. avatar+handle on Instagram). */
  above?: SlotNode[];
  /** The cover image — optional but typical. */
  cover?: CoverNode;
  /** Nodes overlaid on top of the cover. */
  overlays?: OverlayNode[];
  /** Nodes rendered below the cover (the default meta block). */
  below?: SlotNode[];
  /** Horizontal-orientation only: nodes to the right of the cover. */
  aside?: SlotNode[];
}
