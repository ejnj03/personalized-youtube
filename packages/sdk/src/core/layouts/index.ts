/**
 * Public surface of the collection layout preset system. Mirrors the
 * core/cards/ and core/fonts/ layout.
 */

export type { LayoutKind, LayoutPreset, LayoutPresetCatalog } from './types';
export { DEFAULT_LAYOUT_PRESETS } from './catalog';
export { defineLayoutPresets, resolveLayoutPreset } from './schema';
export type { DefineLayoutPresetsOptions } from './schema';
