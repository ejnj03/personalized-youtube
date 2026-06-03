/**
 * Seed script — inserts the base PageConfig row for the youtube-clone site.
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
import { PageConfigSchema, type PageConfig } from '@showcase/shared';

const SITE_SLUG = 'youtube-clone';

function makeBaseConfig(): PageConfig {
  const config: PageConfig = {
    id: 'youtube-clone',
    slug: SITE_SLUG,
    theme: {
      mode: 'light',
      accent: '#FF0000',
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
  await db.from('sites').upsert(
    { slug: SITE_SLUG, base_config: baseConfig, updated_at: new Date().toISOString() },
    { onConflict: 'slug' },
  );
  console.log(`Upserted site row for slug=${SITE_SLUG} (empty feed; videos served by the YouTube adapter)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
