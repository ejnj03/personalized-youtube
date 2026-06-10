// packages/sdk/src/core/fonts/schema.ts

import { z } from 'zod';
import { DEFAULT_FONTS } from './catalog';
import type { FontCatalog } from './types';

export interface DefineFontsOptions {
  /** Which catalog entry is chosen when no patch has set one yet. */
  defaultKey?: string;
  /** If true, replace DEFAULT_FONTS entirely instead of merging into it. */
  replace?: boolean;
}

/**
 * Build the Zod schema for a host's theme.fontFamily field.
 *
 * Hosts call this in their ThemeSchema. The returned enum's values are the
 * catalog's keys, and the description lists each option's vibe so Claude
 * can pick by mood.
 *
 * @example
 *   // Use the SDK defaults as-is
 *   fontFamily: defineFonts()
 *
 *   // Extend with a brand font
 *   fontFamily: defineFonts({
 *     'spotify-mix': { family: 'SpotifyMixUI', google: '',
 *       description: 'Native spotify font', category: 'sans' },
 *   })
 *
 *   // Curated palette — replace defaults entirely
 *   fontFamily: defineFonts(myCatalog, { replace: true })
 */
export function defineFonts(
  overrides: FontCatalog = {},
  options: DefineFontsOptions = {},
) {
  const { defaultKey = 'inter', replace = false } = options;
  const catalog: FontCatalog = replace ? overrides : { ...DEFAULT_FONTS, ...overrides };

  const keys = Object.keys(catalog) as [string, ...string[]];
  if (keys.length === 0) {
    throw new Error('defineFonts: catalog is empty');
  }

  // Catalog summary for Claude's schema view. One line per font:
  //   "inter: Clean modern sans-serif. The default safe choice..."
  const catalogText = keys
    .map((k) => `- ${k}: ${catalog[k]!.description}`)
    .join('\n');

  const schema = z
    .enum(keys)
    .default(keys.includes(defaultKey) ? defaultKey : keys[0])
    .describe(
        `Page font. Pick to match the visitor's vibe (modern, editorial, ` +
        `playful, technical, etc.). Each option:\n${catalogText}`,
    );

  return { schema, catalog };
}
