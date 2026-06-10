import type { FontCatalog } from './types';
import { LANG_FONT_URLS } from './lang-urls';

/**
 * Build the single Google Fonts <link> URL for the given catalog. Includes:
 *  - every Latin font (each entry's `google` spec)
 *  - every language partner family REFERENCED by some entry's `fallbacks`
 *    (looked up in langUrls; unreferenced langUrls entries are skipped)
 *
 * Result is one URL with all `&family=...` query parts joined, plus
 * `&display=swap` so text shows in the fallback font during font fetch.
 *
 * Example output (truncated):
 *   https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700
 *     &family=Space+Grotesk:wght@400;500;700
 *     &family=Noto+Sans+KR:wght@400;500;700
 *     ...
 *     &display=swap
 */
export function buildGoogleFontsUrl(
  catalog: FontCatalog,
  langUrls: Record<string, string> = LANG_FONT_URLS,
): string {
  const specs = new Set<string>();

  // Latin fonts — one spec per catalog entry.
  for (const entry of Object.values(catalog)) {
    if (entry.google) specs.add(entry.google);
  }

  // Language partners — only the families referenced by some entry's fallbacks.
  for (const entry of Object.values(catalog)) {
    for (const family of Object.values(entry.fallbacks ?? {})) {
      const spec = langUrls[family];
      if (spec) specs.add(spec);
    }
  }

  const familyParams = Array.from(specs)
    .map((spec) => `family=${spec}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}
