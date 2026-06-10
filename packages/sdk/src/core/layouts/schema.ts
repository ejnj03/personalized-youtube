import { z } from 'zod';
import { DEFAULT_LAYOUT_PRESETS } from './catalog';
import type { LayoutPresetCatalog, LayoutPreset } from './types';

export interface DefineLayoutPresetsOptions {
  defaultKey?: string;
  replace?: boolean;
}

/**
 * Build the Zod schema + resolved catalog for a host's layout presets.
 * Same shape as defineCardPresets / defineFonts.
 */
export function defineLayoutPresets(
  overrides: LayoutPresetCatalog = {},
  options: DefineLayoutPresetsOptions = {},
) {
  const { defaultKey = 'grid_default', replace = false } = options;
  const catalog: LayoutPresetCatalog = replace
    ? overrides
    : { ...DEFAULT_LAYOUT_PRESETS, ...overrides };

  const keys = Object.keys(catalog) as [string, ...string[]];
  if (keys.length === 0) throw new Error('defineLayoutPresets: catalog is empty');

  const catalogText = keys
    .map((k) => `- ${k}: ${catalog[k]!.description}`)
    .join('\n');

  const schema = z
    .enum(keys)
    .default(keys.includes(defaultKey) ? defaultKey : keys[0])
    .describe(
      `Collection layout — how a row/grid of cards is arranged on the ` +
        `page. Switching this changes columns, gap, and scroll behavior ` +
        `in one move. Options:\n${catalogText}`,
    );

  return { schema, catalog };
}

/**
 * Resolve the effective layout preset.
 *   theme-level key → look up catalog
 *   section-level key (if any) → wins
 * No overrides layer for layouts — keep it preset-only for now.
 */
export function resolveLayoutPreset(
  catalog: LayoutPresetCatalog,
  themePresetKey: string,
  sectionPresetKey?: string,
): LayoutPreset {
  return (
    (sectionPresetKey && catalog[sectionPresetKey]) ||
    catalog[themePresetKey] ||
    catalog['grid_default']!
  );
}
