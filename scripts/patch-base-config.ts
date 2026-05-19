/**
 * One-shot: patch the existing site's base_config to include the new templates
 * without re-running video generation. Idempotent — replaces the sections array.
 *
 * Run: pnpm patch-config
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { PageConfigSchema, type PageConfig, type Video } from '@showcase/shared';

const SITE_SLUG = 'youtube-clone';

function pickRandom<T>(items: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  let idx = seed % items.length;
  while (out.length < Math.min(n, items.length)) {
    if (!used.has(idx)) {
      out.push(items[idx]!);
      used.add(idx);
    }
    idx = (idx * 7 + 31) % items.length;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase env missing');
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const catalogPath = resolve(__dirname, '../apps/web/lib/mock-data/videos.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf-8')) as { videos: Video[] };
  const allVideos = catalog.videos;

  const { data: site } = await db.from('sites').select('id, base_config').eq('slug', SITE_SLUG).single();
  if (!site) throw new Error(`No site row; run pnpm seed first`);

  const current = site.base_config as PageConfig;
  const existingGrid = current.sections.find((s) => s.type === 'VideoGrid');
  const gridVideos = (existingGrid?.props as { videos?: Video[] })?.videos ?? allVideos.slice(0, 60);

  const continueVideos = pickRandom(allVideos, 6, 11);
  const recommendedVideos = pickRandom(allVideos, 12, 23);
  const shortsBase = pickRandom(allVideos, 10, 47);

  const newSections: PageConfig['sections'] = [
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
      id: 'filterSummary',
      type: 'FilterSummary',
      props: { visible: true, active: [] },
    },
    {
      id: 'continueWatching',
      type: 'ContinueWatchingRow',
      props: {
        visible: true,
        headline: 'Continue watching',
        videos: continueVideos,
      },
    },
    {
      id: 'shortsRow',
      type: 'ShortsRow',
      props: {
        visible: true,
        headline: 'Shorts',
        shorts: shortsBase.map((v) => ({
          id: `short-${v.id}`,
          title: v.title.length > 50 ? v.title.slice(0, 47) + '…' : v.title,
          thumbnail: v.thumbnail,
          views: v.views,
          channel: v.channel,
        })),
      },
    },
    {
      id: 'videoGrid',
      type: 'VideoGrid',
      props: {
        columns: (existingGrid?.props as { columns?: 2 | 3 | 4 | 5 })?.columns ?? 4,
        density: (existingGrid?.props as { density?: 'compact' | 'cozy' | 'comfortable' })?.density ?? 'cozy',
        videos: gridVideos,
      },
    },
    {
      id: 'recommendedRow',
      type: 'RecommendedRow',
      props: {
        headline: 'Recommended for you',
        videos: recommendedVideos,
      },
    },
    {
      id: 'customNote',
      type: 'CustomNote',
      props: { text: '', visible: false },
    },
  ];

  const next: PageConfig = PageConfigSchema.parse({
    ...current,
    sections: newSections,
  });

  await db.from('sites').update({ base_config: next, updated_at: new Date().toISOString() }).eq('slug', SITE_SLUG);
  console.log(`Patched base_config for slug=${SITE_SLUG} (${next.sections.length} sections)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
