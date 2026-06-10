'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PageConfig, Section, Video } from '@showcase/shared';
import { cardPresetCatalog, layoutPresetCatalog } from '@showcase/shared';
import { resolveCardPreset, resolveLayoutPreset } from '@showcase/sdk/core';
import { MediaCollection, useSourceRules } from '@showcase/sdk';
import { VideoCard } from './VideoCard';
import { applyFeedFilter } from './_filter';
import { usePageStore } from '@/lib/store';

// provideContent for the SDK rule engine: one curated term (a query OR a
// channel/youtuber) → YouTube search results. The hook fans out over every
// term of every active rule and merges; this just runs one search.
const ytSearchTerm = (term: string): Promise<Video[]> =>
  fetch(`/api/yt/search?q=${encodeURIComponent(term)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { ok?: boolean; videos?: Video[] } | null) =>
      Array.isArray(d?.videos) ? (d!.videos as Video[]) : [],
    )
    .catch(() => [] as Video[]);

// Density only governs vertical padding around the collection now; the
// horizontal column count + card gap live on the layout preset.
const DENSITY_PADY: Record<'compact' | 'cozy' | 'comfortable', string> = {
  compact: 'py-1',
  cozy: 'py-2',
  comfortable: 'py-3',
};

function parseDurationSeconds(s: string): number {
  const parts = s.split(':').map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return 0;
}

function applyNavFilter(
  videos: Video[],
  activeNav: string,
  selectedChannel: string | null,
): Video[] {
  switch (activeNav) {
    case 'Shorts':
      return videos.filter(
        (v) => parseDurationSeconds(v.duration) <= 60 || v.tags.includes('shorts'),
      );
    case 'Subscriptions':
      if (!selectedChannel) return videos;
      return videos.filter((v) => v.channel.name === selectedChannel);
    case 'You':
    case 'History':
      return videos.filter((v) => v.watched === true);
    default:
      return videos;
  }
}

export function VideoGrid({ section, config }: { section: Section; config: PageConfig }) {
  const { dispatch, ytContinuation, setYtContinuation, activeNav, selectedChannel, setActiveNav } = usePageStore();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sectionId = section.id;
  const sectionVideos = section.type === 'VideoGrid' ? section.props.videos : [];

  // ---- Curated feed (SDK SourceRules: multi-rule, schedule-gated) ----
  const sources = (section.type === 'VideoGrid' ? section.props.sources : []) ?? [];
  const sectionSchedule = section.type === 'VideoGrid' ? section.props.schedule : undefined;
  const {
    items: curatedVideos,
    loading: isLoadingCurated,
    active: shouldUseCurated,
  } = useSourceRules<Video>({
    rules: sources,
    fallbackSchedule: sectionSchedule,
    provideContent: ytSearchTerm,
    itemKey: (v) => v.id,
    itemTitle: (v) => v.title,
  });
  // ---- end curated feed ----

  // Infinite scroll: when the sentinel scrolls into view AND we have a
  // continuation token, fetch the next page and append to this section.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !ytContinuation) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        const tok = ytContinuation;
        fetch(`/api/yt/more?token=${encodeURIComponent(tok)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { ok?: boolean; videos?: Video[]; continuation?: string | null } | null) => {
            if (!data || !data.ok || !Array.isArray(data.videos) || data.videos.length === 0) {
              setYtContinuation(null);
              return;
            }
            const seenIds = new Set(sectionVideos.map((v) => v.id));
            const fresh = data.videos.filter((v) => !seenIds.has(v.id));
            if (fresh.length > 0) {
              dispatch({
                op: 'update_section',
                sectionId,
                patch: { videos: [...sectionVideos, ...fresh] },
              });
            }
            setYtContinuation(typeof data.continuation === 'string' && data.continuation.length > 0 ? data.continuation : null);
          })
          .catch(() => {
            setYtContinuation(null);
          })
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: '400px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ytContinuation, loadingMore, sectionId, sectionVideos, dispatch, setYtContinuation]);

  if (section.type !== 'VideoGrid') return null;
  const { columns, density, videos, layout } = section.props;
  // When the curated-feed path is active and we have results, those replace
  // the static `videos` prop. Existing nav + feed filters still apply on top.
  const effectiveVideos = shouldUseCurated && curatedVideos ? curatedVideos : videos;
  const padY = DENSITY_PADY[density];
  const navFiltered = applyNavFilter(effectiveVideos, activeNav, selectedChannel);
  const filtered = applyFeedFilter(navFiltered, config);

  if (filtered.length === 0) {
    const hasFilters =
      config.filter.requireTags.length > 0 ||
      config.filter.exclude.length > 0 ||
      config.filter.blockChannels.length > 0 ||
      config.filter.include.length > 0 ||
      !!config.filter.minDurationSeconds ||
      !!config.filter.maxDurationSeconds ||
      !!config.filter.minSubscriberCount ||
      !!config.filter.maxSubscriberCount;
    const navIsActive = activeNav !== 'Home';

    const navMessage =
      activeNav === 'Subscriptions'
        ? selectedChannel
          ? `No videos from ${selectedChannel} in the current feed.`
          : 'Pick a channel under Subscriptions to see their videos.'
        : activeNav === 'Shorts'
          ? 'No shorts in the current feed.'
          : activeNav === 'You' || activeNav === 'History'
            ? 'No watched videos yet.'
            : null;

    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--muted)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current text-[color:var(--muted-fg)]">
            <path d="M10 4a6 6 0 1 0 3.7 10.7l5.3 5.3 1.4-1.4-5.3-5.3A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
          </svg>
        </div>
        <p className="text-lg font-medium">
          {navMessage ?? 'No videos match your filters.'}
        </p>
        <p className="max-w-md text-sm text-[color:var(--muted-fg)]">
          Try a broader filter, ask the chat for more content, or clear filters.
        </p>
        {navIsActive && (
          <button
            onClick={() => setActiveNav('Home', null)}
            className="mt-2 rounded-full border border-[color:var(--border)] bg-[color:var(--bg)] px-4 py-1.5 text-sm hover:bg-[color:var(--muted)]"
          >
            Back to Home
          </button>
        )}
        {hasFilters && (
          <button
            onClick={() =>
              dispatch(
                {
                  op: 'set_filter',
                  filter: {
                    requireTags: [],
                    exclude: [],
                    blockChannels: [],
                    include: [],
                    minDurationSeconds: undefined,
                    maxDurationSeconds: undefined,
                    minSubscriberCount: undefined,
                    maxSubscriberCount: undefined,
                  },
                },
                { persist: true, rationale: 'cleared via empty-state action' },
              )
            }
            className="mt-2 rounded-full border border-[color:var(--border)] bg-[color:var(--bg)] px-4 py-1.5 text-sm hover:bg-[color:var(--muted)]"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  // Resolve presets. Section-level layoutPreset wins over theme.layoutPreset.
  // Card orientation comes from the resolved card preset (theme + section).
  const themeAny = config.theme as any;
  const themeLayoutKey: string = themeAny.layoutPreset ?? 'grid_default';
  const themeCardKey: string = themeAny.cardPreset ?? 'video_card';
  const sectionCardKey: string | undefined = (section.props as any).cardPreset;
  const sectionLayoutKey: string | undefined = (section.props as any).layoutPreset;
  const cardPresetResolved = resolveCardPreset(
    cardPresetCatalog,
    themeCardKey,
    themeAny.cardOverrides ?? {},
    sectionCardKey,
  );
  const layoutPresetResolved = resolveLayoutPreset(
    layoutPresetCatalog,
    themeLayoutKey,
    sectionLayoutKey,
  );
  // MediaCollection handles the "horizontal cards → ≤2 columns" constraint
  // internally — we just pass the orientation through.
  const cardOrientation = cardPresetResolved.orientation;

  // Bookshop "shelves" layout — section-titled groups of 2-col cards. Auto-
  // partitions the feed into chunks so it always feels curated.
  if (layout === 'shelves') {
    const chunkSize = 4;
    const shelfTitles = ['Recently in', 'On the long table', 'For a quiet evening', 'On the high shelf'];
    const shelves: Array<{ title: string; items: Video[] }> = [];
    for (let i = 0; i < filtered.length; i += chunkSize) {
      shelves.push({
        title: shelfTitles[shelves.length % shelfTitles.length]!,
        items: filtered.slice(i, i + chunkSize),
      });
    }
    // Shelves use a fixed 2-col grid layout regardless of theme preset —
    // the bookshop scenario is the only place this layout shape applies.
    const shelfLayout = { kind: 'grid' as const, columns: 2, gap: 28, scrollSnap: false, description: '' };
    return (
      <div className="flex flex-col gap-9 px-6 py-3">
        {shelves.map((sh, i) => (
          <section key={i}>
            <h2
              className="mb-1 text-2xl italic"
              style={{ fontFamily: 'var(--font-serif, "Source Serif 4", Georgia, serif)' }}
            >
              {sh.title}
            </h2>
            <div className="mb-3 h-px bg-gradient-to-r from-[color:var(--border)] to-transparent" />
            <MediaCollection preset={shelfLayout} cardOrientation={cardOrientation}>
              {sh.items.map((v) => (
                <VideoCard key={v.id} video={v} config={config} cardPresetOverride={sectionCardKey} />
              ))}
            </MediaCollection>
          </section>
        ))}
        {ytContinuation && (
          <div ref={sentinelRef} className="py-6 text-center text-xs text-[color:var(--muted-fg)]">
            {loadingMore ? 'Loading more…' : ' '}
          </div>
        )}
      </div>
    );
  }

  if (layout === 'list') {
    // 'list' is a single-column override of whatever the theme preset is.
    const listLayout = { kind: 'grid' as const, columns: 1, gap: 12, scrollSnap: false, description: '' };
    return (
      <>
        <div className="px-6 py-3">
          <MediaCollection preset={listLayout} cardOrientation={cardOrientation}>
            {filtered.map((v) => (
              <VideoCard key={v.id} video={v} config={config} cardPresetOverride={sectionCardKey} />
            ))}
          </MediaCollection>
        </div>
        {ytContinuation && (
          <div ref={sentinelRef} className="py-6 text-center text-xs text-[color:var(--muted-fg)]">
            {loadingMore ? 'Loading more…' : ' '}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={`px-6 ${padY}`}>
        <MediaCollection preset={layoutPresetResolved} cardOrientation={cardOrientation}>
          {filtered.map((v) => (
            <VideoCard key={v.id} video={v} config={config} cardPresetOverride={sectionCardKey} />
          ))}
        </MediaCollection>
      </div>
      {ytContinuation && (
        <div ref={sentinelRef} className="px-6 py-6 text-center text-xs text-[color:var(--muted-fg)]">
          {loadingMore ? 'Loading more videos…' : ' '}
        </div>
      )}
    </>
  );
}
