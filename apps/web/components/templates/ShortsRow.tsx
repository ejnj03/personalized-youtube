'use client';

import { useEffect, useRef, useState } from 'react';
import type { PageConfig, Section } from '@showcase/shared';
import { usePageStore } from '@/lib/store';

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function ShortCard({ id, title, thumbnail, views }: { id: string; title: string; thumbnail: string; views: number }) {
  const [hidden, setHidden] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { setWatching } = usePageStore();
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setHidden(true);
  }, []);
  if (hidden) return null;
  return (
    <a
      href={`https://www.youtube.com/shorts/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        setWatching(id, title);
      }}
      className="w-44 shrink-0 cursor-pointer"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[color:var(--muted)]">
        <img
          ref={imgRef}
          src={thumbnail}
          alt={title}
          loading="lazy"
          onError={() => setHidden(true)}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="line-clamp-2 text-xs font-medium text-white">{title}</p>
          <p className="mt-1 text-[10px] text-white/80">{formatViews(views)} views</p>
        </div>
      </div>
    </a>
  );
}

export function ShortsRow({ section }: { section: Section; config: PageConfig }) {
  if (section.type !== 'ShortsRow') return null;
  const { visible, headline, shorts } = section.props;
  if (!visible || shorts.length === 0) return null;

  return (
    <section className="px-6 py-3">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded bg-[color:var(--accent)] text-[color:var(--accent-fg)]">
          ⚡
        </span>
        {headline}
      </h2>
      <div className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3">
          {shorts.map((s) => (
            <ShortCard key={s.id} id={s.id} title={s.title} thumbnail={s.thumbnail} views={s.views} />
          ))}
        </div>
      </div>
    </section>
  );
}
