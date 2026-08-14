'use client';

import { useEffect, useState } from 'react';
import type { PageConfig, Section, Video } from '@showcase/shared';
import { cardPresetCatalog, layoutPresetCatalog } from '@showcase/shared';
import { resolveCardPreset, resolveLayoutPreset } from '@showcase/sdk/core';
import { MediaCollection, useSourceRules } from '@showcase/sdk';
import { VideoCard } from './VideoCard';
import { applyFeedFilter } from './_filter';
import { usePageStore } from '@/lib/store';

// provideContent for the SDK rule engine: one curated term → YT search results.
const ytSearchTerm = (term: string): Promise<Video[]> =>
  fetch(`/api/yt/search?q=${encodeURIComponent(term)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { videos?: Video[] } | null) => (Array.isArray(d?.videos) ? (d!.videos as Video[]) : []))
    .catch(() => [] as Video[]);

// Click-to-rename row title. Commits via update_section so the rename persists.
function EditableHeadline({ sectionId, headline }: { sectionId: string; headline: string }) {
  const { dispatch } = usePageStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(headline);
  useEffect(() => setDraft(headline), [headline]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== headline) {
      dispatch({ op: 'update_section', sectionId, patch: { headline: next } }, { persist: true });
    } else {
      setDraft(headline);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(headline);
            setEditing(false);
          }
        }}
        className="mb-3 w-full max-w-md rounded bg-[color:var(--muted)] px-2 py-1 text-base font-semibold outline-none ring-1 ring-[color:var(--border)]"
      />
    );
  }
  return (
    <h2
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="mb-3 -mx-1 inline-block cursor-text rounded px-1 text-base font-semibold transition-colors hover:bg-[color:var(--muted)]"
    >
      {headline}
    </h2>
  );
}

export function RecommendedRow({ section, config }: { section: Section; config: PageConfig }) {
  // Hooks must run unconditionally — guard the type after.
  const isRow = section.type === 'RecommendedRow';
  const sources = isRow ? section.props.sources ?? [] : [];
  const schedule = isRow ? section.props.schedule : undefined;
  const { items: curated, active: curatedActive } = useSourceRules<Video>({
    rules: sources,
    fallbackSchedule: schedule,
    provideContent: ytSearchTerm,
    itemKey: (v) => v.id,
    itemTitle: (v) => v.title,
  });

  if (!isRow) return null;
  // Defensive defaults: a section the agent just added via add_section may not
  // have every field materialized if the patch path didn't re-parse the schema.
  const headline = section.props.headline ?? 'Recommended for you';
  const videos = section.props.videos ?? [];
  const pinned = section.props.pinned ?? [];
  const maxItems = section.props.maxItems ?? 16;

  // Base list: curated (when a rule is active) else the static videos. Filters
  // apply to the base only. Pinned videos render FIRST and bypass filters.
  const base = curatedActive && curated ? curated : videos;
  const filteredBase = applyFeedFilter(base, config);
  // Pinned stubs ({id,title,channel}) → minimal Video for the card; thumbnail
  // is derived from the id so the agent never has to echo a URL.
  const pinnedVideos: Video[] = (pinned ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    channel: { name: p.channel, avatar: '', verified: false, subscriberCount: 0 },
    thumbnail: `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`,
    duration: '',
    views: 0,
    postedAgo: '',
    tags: [],
    description: '',
    category: '',
  }));
  const pinnedIds = new Set(pinnedVideos.map((v) => v.id));
  const ordered = [
    ...pinnedVideos,
    ...filteredBase.filter((v) => !pinnedIds.has(v.id)),
  ].slice(0, maxItems);

  if (ordered.length === 0) return null;

  // Resolve the section's card preset → orientation for MediaCollection.
  const themeAny = config.theme as any;
  const sectionCardKey: string | undefined = (section.props as any).cardPreset;
  const sectionLayoutKey: string | undefined = (section.props as any).layoutPreset;
  const cardPresetResolved = resolveCardPreset(
    cardPresetCatalog,
    themeAny.cardPreset ?? 'video_card',
    themeAny.cardOverrides ?? {},
    sectionCardKey,
  );
  // Render with the page layout preset (a GRID by default) so a named row has
  // the same dimensions as the main feed instead of a horizontal carousel.
  // props.layoutPreset can override to "row_scroll" for a carousel.
  const layoutPresetResolved = resolveLayoutPreset(
    layoutPresetCatalog,
    themeAny.layoutPreset ?? 'grid_default',
    sectionLayoutKey,
  );

  return (
    <section className="px-6 py-3">
      <EditableHeadline sectionId={section.id} headline={headline} />
      <MediaCollection preset={layoutPresetResolved} cardOrientation={cardPresetResolved.orientation}>
        {ordered.map((v) => (
          <VideoCard key={v.id} video={v} config={config} cardPresetOverride={sectionCardKey} />
        ))}
      </MediaCollection>
    </section>
  );
}
