import { useEffect } from 'react';
import { useConfig } from '@showcase/sdk';
import type { SpotifyTheme } from './host';

// Rewrites the document's <link rel="icon"> to an inline SVG data URL using
// the live accent color. Runs whenever theme.tokens.accent changes, so the
// browser tab icon stays in sync with the personalized palette.
function buildFaviconDataUrl(accent: string, fg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="16" fill="${accent}"/>
    <g fill="none" stroke="${fg}" stroke-linecap="round" stroke-width="2.4">
      <path d="M9 19 Q16 16 23 19"/>
      <path d="M10 15 Q16 12 22 15"/>
      <path d="M11 11 Q16 9 21 11"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function ThemedFavicon() {
  const config = useConfig();
  const theme = config.theme as SpotifyTheme;
  const tokens = theme.tokens as Record<string, string>;
  const accent = tokens.accent ?? '#1db954';
  const fg = tokens.accentFg ?? '#000000';

  useEffect(() => {
    const href = buildFaviconDataUrl(accent, fg);
    const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'];
    for (const sel of selectors) {
      document.querySelectorAll<HTMLLinkElement>(sel).forEach((link) => {
        link.type = 'image/svg+xml';
        link.removeAttribute('sizes');
        link.href = href;
      });
    }
  }, [accent, fg]);

  return null;
}
