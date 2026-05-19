import { useEffect, useMemo, useState } from 'react';
import type { PageConfig, Section, Video } from '@showcase/shared';
import { VideoCard } from './VideoCard';
import { applyFeedFilter } from './_filter';

export function RecommendedRow({ section, config }: { section: Section; config: PageConfig }) {
  if (section.type !== 'RecommendedRow') return null;
  const { headline, videos, sources } = section.props;
  const sourcesKey = useMemo(() => JSON.stringify(sources ?? []), [sources]);
  const [fetched, setFetched] = useState<Video[] | null>(null);

  // If the chat added this row with curated `sources`, fetch real videos from
  // /api/yt/search per query and merge — same contract as VideoGrid.sources.
  useEffect(() => {
    if (!sources || sources.length === 0) {
      setFetched(null);
      return;
    }
    let cancelled = false;
    Promise.all(
      sources.map((s) =>
        fetch(`/api/yt/search?q=${encodeURIComponent(s.query)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { videos?: Video[] } | null) =>
            Array.isArray(d?.videos) ? (d.videos as Video[]).slice(0, s.topN) : [],
          )
          .catch(() => [] as Video[]),
      ),
    ).then((arrays) => {
      if (cancelled) return;
      const merged = new Map<string, Video>();
      for (const arr of arrays) for (const v of arr) if (!merged.has(v.id)) merged.set(v.id, v);
      setFetched(Array.from(merged.values()));
    });
    return () => {
      cancelled = true;
    };
  }, [sourcesKey]);

  const effective = fetched && fetched.length > 0 ? fetched : videos;
  const filtered = applyFeedFilter(effective, config).slice(0, 12);
  if (filtered.length === 0) return null;

  return (
    <section className="px-6 py-3">
      <h2 className="mb-3 text-base font-semibold">{headline}</h2>
      <div className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4">
          {filtered.map((v) => (
            <div key={v.id} className="w-72 shrink-0">
              <VideoCard video={v} config={config} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
