/**
 * Public surface of the font catalog system. Re-exports from each sub-file
 * so external consumers can write a single import:
 *
 *   import { DEFAULT_FONTS, buildFontStack, buildGoogleFontsUrl } from './core/fonts';
 *
 * Internal layout:
 *   - types.ts      — FontCategory, FontEntry, FontCatalog
 *   - lang-urls.ts  — LANG_FONT_URLS (family → Google Fonts URL spec)
 *   - catalog.ts    — DEFAULT_FONTS (the 24-font default catalog)
 *   - stack.ts      — buildFontStack (catalog entry → font-family string)
 *   - url.ts        — buildGoogleFontsUrl (catalog → Google Fonts <link> URL)
 *
 * `defineFonts()` (the Zod factory) and any future helpers should be added
 * as new files in this directory and re-exported here.
 */

export type { FontCategory, FontEntry, FontCatalog } from './types';
export { LANG_FONT_URLS } from './lang-urls';
export { DEFAULT_FONTS } from './catalog';
export { buildFontStack } from './stack';
export { buildGoogleFontsUrl } from './url';
export { defineFonts } from './schema';
export type { DefineFontsOptions } from './schema';
