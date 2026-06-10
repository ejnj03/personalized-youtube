/**
 * Universal color tokens — the smallest viable palette every host can theme.
 *
 * Hosts embed `TokensSchema` inside their theme schema:
 *
 *   const ThemeSchema = z.object({
 *     tokens: TokensSchema,
 *     // ...host-specific extensions
 *   });
 *
 * On every change to `config.theme.tokens`, <PersonalizationRoot> writes the
 * fields to `document.documentElement.style` as CSS variables (camelCase →
 * kebab-case: `mutedFg` → `--muted-fg`). Host stylesheets read them via
 * `var(--bg)`, `var(--accent)`, etc.
 *
 * The defaults below match `packages/sdk/src/styles.css` so the chat panel
 * and any opt-in host components render correctly before the visitor has
 * made a single change.
 */

import { z } from 'zod';

/**
 * The shape every set of tokens must satisfy. All values are arbitrary CSS
 * color strings — hex, rgb(), hsl(), `var()` references, named colors, etc.
 */
export interface Tokens {
  bg: string;
  fg: string;
  surface: string;
  muted: string;
  mutedFg: string;
  border: string;
  accent: string;
  accentFg: string;
}

/**
 * The SDK's neutral light-mode palette. Hosts use this as-is when they have
 * no opinion (or when they want a clean light starting point). Hosts with a
 * specific brand call `defineTokens({...})` instead.
 */
export const DEFAULT_TOKENS: Tokens = {
  bg: '#ffffff',
  fg: '#0a0a0a',
  surface: '#ffffff',
  muted: '#f4f4f5',
  mutedFg: '#71717a',
  border: '#e4e4e7',
  accent: '#2563eb',
  accentFg: '#ffffff',
};

/**
 * Default Tokens schema using the SDK's neutral light palette. Embed this
 * directly when you have no brand opinion; otherwise prefer `defineTokens`.
 */
export const TokensSchema = defineTokens();

/**
 * Build a Tokens schema with host-specific defaults baked into each field.
 *
 * Why a factory and not just `.default({...})` on the wrapper:
 *   When chat sends a partial patch like `{ tokens: { bg: '#ff66cc' } }`,
 *   the OTHER tokens get re-defaulted from their per-field defaults. If
 *   those defaults are the SDK's light-mode values, the host's brand
 *   palette collapses on every partial update. `defineTokens` overrides
 *   each field's default, so partial chat updates preserve the host's
 *   intended palette.
 *
 * Accepts a `Partial<Tokens>` so hosts can override just the tokens they
 * care about; unspecified tokens fall back to `DEFAULT_TOKENS`.
 *
 * @example
 *   // spotify host
 *   const ThemeSchema = z.object({
 *     tokens: defineTokens({
 *       bg: '#121212', fg: '#ffffff',
 *       surface: '#1f1f1f', muted: '#282828', mutedFg: '#b3b3b3',
 *       border: '#2a2a2a',
 *       accent: '#1db954', accentFg: '#000000',
 *     }),
 *   });
 */
export function defineTokens(overrides: Partial<Tokens> = {}) {
  const d = { ...DEFAULT_TOKENS, ...overrides };
  // The .describe() calls below are surfaced to Claude in the schema catalog
  // segment of the system prompt. They're the single biggest lever on how
  // accurately Claude picks the right token for an ambiguous prompt.
  return z.object({
    bg: z.string().default(d.bg).describe(
      'Main page background. Use when the visitor says "background", "page color", or names a vibe ("make it cozier", "warmer").',
    ),
    fg: z.string().default(d.fg).describe(
      'Primary text color on `bg`. Pair with `bg` for readable contrast — flip with `bg` when toggling light/dark.',
    ),
    surface: z.string().default(d.surface).describe(
      'Cards, panels, drawers, elevated surfaces. Use when prompts target "cards", "panels", or one tier above the page background.',
    ),
    muted: z.string().default(d.muted).describe(
      'Secondary surfaces — chips, hover states, divider regions, dropdown backgrounds. One tier above `surface` for emphasis.',
    ),
    mutedFg: z.string().default(d.mutedFg).describe(
      'Secondary text — timestamps, meta lines, placeholders. Less prominent than `fg`.',
    ),
    border: z.string().default(d.border).describe(
      'Dividers, card edges, input borders. Subtle separators between regions.',
    ),
    accent: z.string().default(d.accent).describe(
      'Brand color / CTAs / active states / focus rings. Use when the visitor says "accent", "highlight", "make X stand out", or names a brand color ("more green").',
    ),
    accentFg: z.string().default(d.accentFg).describe(
      'Text on `accent` — must contrast with `accent`. Update together with `accent` to keep buttons readable.',
    ),
  }).default({});
}

/**
 * Convert a token key (`mutedFg`) to its CSS variable name (`--muted-fg`).
 * Centralized so the publisher and any consumers agree on the convention.
 */
export function tokenKeyToCssVar(key: string): string {
  return '--' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * React-side counterpart to the CSS variables. Each entry is the `var(--x)`
 * reference *as a string* — drop directly into JSX inline styles and the
 * browser resolves at paint time, same as if it were in a stylesheet.
 *
 * Use this so JSX-inline-style code (gradients, computed backgrounds, etc.)
 * stays in sync with stylesheet-driven code without subscribing to React
 * context. Both paths read from the same CSS variable.
 *
 * @example
 *   <div style={{ background: TOKEN.bg }} />
 *   <div style={{ background: `linear-gradient(180deg, ${TOKEN.bg} 2%, ${TOKEN.muted} 11%)` }} />
 */
export const TOKEN = {
  bg: 'var(--bg)',
  fg: 'var(--fg)',
  surface: 'var(--surface)',
  muted: 'var(--muted)',
  mutedFg: 'var(--muted-fg)',
  border: 'var(--border)',
  accent: 'var(--accent)',
  accentFg: 'var(--accent-fg)',
} as const;

export type TokenKey = keyof typeof TOKEN;
