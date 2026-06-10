/**
 * Type contracts for the font catalog system.
 *
 * Keeping types in their own file lets every other file in this directory
 * import only what it needs — no circular dependencies.
 */

export type FontCategory =
  | 'sans'
  | 'display'
  | 'serif'
  | 'mono'
  | 'handwritten'
  | 'rounded'
  | 'decorative';

export interface FontEntry {
  /** CSS font-family value, e.g. "Inter". Must match the Google Fonts canonical name. */
  family: string;
  /** URL parameter for the Google Fonts loader, e.g. "Inter:wght@400;500;700". */
  google: string;
  /**
   * Per-language fallbacks. Keys are ISO language codes; values are CSS family
   * names of fonts that handle that language's script. The browser walks the
   * font-family stack left to right per character — so if the visitor picks
   * Inter and types Hangul, the browser falls through to `fallbacks.ko` for
   * those characters automatically.
   *
   * Default catalog ships with `ko` pairings. Hosts add more in
   * `defineFonts({...})` overrides — e.g. to add Japanese:
   *
   *   inter: { ...DEFAULT_FONTS.inter,
   *            fallbacks: { ko: 'Noto Sans KR', ja: 'Noto Sans JP' } }
   *
   * Then add the new family's URL spec to LANG_FONT_URLS so the loader
   * knows to fetch it.
   */
  fallbacks?: Record<string, string>;
  /** Shown to Claude in the schema catalog — guides which font matches which vibe. */
  description: string;
  /** Semantic grouping. Useful if a host ever renders a categorized picker UI. */
  category: FontCategory;
}

export type FontCatalog = Record<string, FontEntry>;
