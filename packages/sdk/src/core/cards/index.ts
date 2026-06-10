/**
 * Public surface of the media card preset system. Mirrors the layout of
 * core/fonts/.
 *
 *   types.ts    — CardPreset, CardAspect, CardOrientation, CardPresetCatalog
 *   catalog.ts  — DEFAULT_CARD_PRESETS (7 archetypes)
 *   schema.ts   — defineCardPresets() + resolveCardPreset()
 */

export type {
  CardPreset,
  CardAspect,
  CardOrientation,
  HoverEffect,
  CardPresetCatalog,
} from './types';
export { DEFAULT_CARD_PRESETS } from './catalog';
export { defineCardPresets, resolveCardPreset, aspectRatioCss } from './schema';
export type { DefineCardPresetsOptions } from './schema';

// Slot-tree layout grammar — the agent emits these to rearrange the parts
// of a card without writing CSS.
export type {
  CardLayout,
  CoverNode,
  SlotNode,
  OverlayNode,
  OverlayPosition,
  SlotTextSize,
  SlotTextColor,
  SlotAvatarSize,
  SlotAvatarShape,
  SlotBadgeColor,
  SlotRowAlign,
} from './layout-types';
export {
  CardLayoutSchema,
  SlotNodeSchema,
  OverlayNodeSchema,
  CoverNodeSchema,
} from './layout-schema';
export {
  VIDEO_CARD_LAYOUT,
  SQUARE_CARD_LAYOUT,
  SHORTS_CARD_LAYOUT,
  COMPACT_CARD_LAYOUT,
  POSTER_CARD_LAYOUT,
  AUDIO_CARD_LAYOUT,
  HORIZONTAL_ROW_LAYOUT,
} from './default-layouts';
