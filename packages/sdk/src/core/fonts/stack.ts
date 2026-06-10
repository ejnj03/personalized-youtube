import type { FontCategory, FontEntry } from './types';

/**
 * Per-category system fallback at the end of the font stack. Used by
 * buildFontStack() — kept private so consumers can't accidentally depend
 * on these specific strings.
 */
function systemFallbackFor(category: FontCategory): string {
  switch (category) {
    case 'mono': return 'ui-monospace, monospace';
    case 'serif': return 'Georgia, serif';
    case 'handwritten': return 'cursive';
    case 'rounded': return 'ui-rounded, system-ui, sans-serif';
    default: return 'system-ui, sans-serif';   // sans / display / decorative
  }
}

/**
 * Build the font-family CSS stack for a catalog entry. Emits Latin font →
 * every language fallback → system fallback. Browser walks left-to-right
 * per character, so mixed-script text uses the closest-matching font for
 * each glyph automatically.
 *
 * Example output:
 *   "Inter", "Noto Sans KR", system-ui, sans-serif
 *
 * Family names with spaces are quoted (CSS requires it for multi-word
 * identifiers). System keywords like `system-ui` and `sans-serif` are
 * left unquoted (they're CSS reserved words).
 */
export function buildFontStack(entry: FontEntry): string {
  const parts: string[] = [`"${entry.family}"`];
  for (const family of Object.values(entry.fallbacks ?? {})) {
    parts.push(`"${family}"`);
  }
  parts.push(systemFallbackFor(entry.category));
  return parts.join(', ');
}
