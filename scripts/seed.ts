/**
 * Seed script — inserts the base PageConfig row for the streaming-platform site.
 * Idempotent: re-running upserts.
 *
 * The 300-video mock catalog this script used to generate has been removed —
 * the feed now comes exclusively from the YouTube adapter (real data when
 * Chrome cookies are present, an anonymous synthetic feed otherwise). The
 * base config ships with an empty VideoGrid; the adapter fills it at request
 * time. No Anthropic key required.
 *
 * Run: pnpm seed
 */

import { createClient } from '@supabase/supabase-js';
import { setSupabaseBaseConfig } from '@showcase/sdk/supabase';
import { PageConfigSchema, type PageConfig } from '@showcase/shared';

const SITE_SLUG = 'streaming-platform';

function makeBaseConfig(): PageConfig {
  const config: PageConfig = {
    id: 'streaming-platform',
    slug: SITE_SLUG,
    theme: {
      // Palette comes from ThemeSchema's defineTokens defaults — base config
      // omits tokens and PageConfigSchema.parse() fills them on load. (Legacy
      // mode/accent removed; the palette now lives in theme.tokens.)
      fontScale: '1',
      radius: 'md',
      videoCardDefaults: {
        aspectRatio: '16:9',
        thumbnailScale: 1,
        titleWeight: 500,
        channelNameWeight: 400,
        showDescription: false,
        showViewCount: true,
        showPostedAgo: true,
        showDuration: true,
      },
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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase env vars missing');

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const baseConfig = makeBaseConfig();
  await setSupabaseBaseConfig(db, SITE_SLUG, baseConfig);

  const { data: check, error: checkErr } = await db
    .from('sites')
    .select('id, slug')
    .eq('slug', SITE_SLUG)
    .single();
  if (checkErr || !check) throw new Error(`Read-back failed: ${checkErr?.message ?? 'row not found'}`);
  console.log(`Upserted + verified site row id=${check.id} slug=${check.slug} on ${supabaseUrl}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
