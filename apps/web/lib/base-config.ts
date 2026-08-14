import type { z } from 'zod';
import { PageConfigSchema, type PageConfig } from '@showcase/shared';

/**
 * The baseline PageConfig for the YouTube reference host.
 *
 * Previously lived in scripts/seed.ts and was written to a Supabase `sites`
 * row, which `getRenderedPage` then read back on every SSR pass. That made a
 * database a hard requirement just to render the default page — and produced
 * the "Site not found: streaming-platform — run `pnpm seed` first" failure
 * whenever the project was missing. It is static data, so it belongs in code.
 *
 * Visitor-specific state (patches, turns, modes) still persists — see
 * lib/persistence/sqlite.ts.
 *
 * Parsed through PageConfigSchema so defineTokens/defineFonts defaults
 * (theme.tokens.*, theme.fontFamily) are materialized; the SDK's token
 * publisher in <PersonalizationRoot> has nothing to write to CSS vars
 * otherwise.
 */

export const SITE_SLUG = 'streaming-platform';

export function makeBaseConfig(): PageConfig {
  // Typed as the schema's INPUT, not PageConfig (its output). The literal
  // deliberately omits fields the schema fills via .default() — theme.tokens,
  // section props like `visible`/`layout`/`sources`, most of `filter`. Typing
  // it as PageConfig would demand every default be written out by hand, which
  // is what the schema exists to avoid.
  const config: z.input<typeof PageConfigSchema> = {
    id: SITE_SLUG,
    slug: SITE_SLUG,
    theme: {
      // Palette comes from ThemeSchema's defineTokens defaults — base config
      // omits tokens and PageConfigSchema.parse() fills them on load.
      fontScale: '1',
      radius: 'md',
      // The seed also carried a `videoCardDefaults` block. Nothing in the
      // codebase references that key — card styling moved to
      // theme.cardPreset / theme.cardLayout — so Zod stripped it on every
      // parse and it had no effect. Dropped rather than ported.
    },
    sections: [
      {
        id: 'topBar',
        type: 'TopBar',
        props: {
          logoText: 'YouTube',
          searchPlaceholder: 'Search',
          compactSearch: false,
          showProfileChip: true,
        },
      },
      {
        id: 'sidebar',
        type: 'Sidebar',
        props: {
          collapsed: false,
          pinnedItems: ['Home', 'Shorts', 'Subscriptions', 'You'],
          showSubscriptions: true,
        },
      },
      {
        id: 'categoryChips',
        type: 'CategoryChips',
        props: {
          active: 'All',
          chips: ['All', 'Music', 'Gaming', 'Live', 'News', 'Cooking', 'Comedy', 'Recently uploaded'],
        },
      },
      {
        id: 'shortsRow',
        type: 'ShortsRow',
        props: {
          headline: 'Shorts',
          shorts: [],
        },
      },
      {
        id: 'videoGrid',
        type: 'VideoGrid',
        props: { columns: 4, density: 'cozy', videos: [] },
      },
    ],
    filter: { include: [], exclude: [], requireTags: [], blockChannels: [] },
    sort: { by: 'recommended', order: 'desc' },
    meta: { title: 'YouTube', favicon: '/favicon.ico' },
  };

  return PageConfigSchema.parse(config);
}
