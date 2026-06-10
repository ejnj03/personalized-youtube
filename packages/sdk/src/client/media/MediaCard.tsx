'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { aspectRatioCss } from '../../core/cards';
import type {
  CardPreset,
  CardLayout,
  SlotNode,
  OverlayNode,
  OverlayPosition,
} from '../../core/cards';
import type { MediaItem } from './types';

const HOVER_CLASS: Record<CardPreset['hoverEffect'], string> = {
  none: '',
  lift: 'transition-transform duration-200 hover:-translate-y-0.5',
  zoom: 'transition-transform duration-200 hover:scale-[1.02]',
};

export interface MediaCardProps {
  /** Host-mapped item data — title, subtitle, cover, stats, etc. */
  item: MediaItem;
  /** Fully resolved card preset (call resolveCardPreset before passing). */
  preset: CardPreset;
  /**
   * Slot-tree layout. When provided, MediaCard walks this tree instead of
   * the legacy fixed layout. Typically set from theme.cardLayout (the
   * agent emits it) or a default layout from the preset catalog.
   */
  layout?: CardLayout;
  /**
   * Optional content rendered absolutely over the cover image — host uses
   * this for watched-state overlays, progress bars, badges, "now playing"
   * indicators, etc. Sits above the badge/duration overlay.
   */
  overlay?: ReactNode;
  /** Optional click handler (host knows what "open this item" means). */
  onClick?: (e: React.MouseEvent) => void;
  /** Optional href for the wrapper anchor. When omitted, renders as a div. */
  href?: string;
  /** Optional class names appended to the outer wrapper (dim, opacity, etc.). */
  outerClassName?: string;
}

// ─── Slot-tree renderer ──────────────────────────────────────────────────

const TEXT_SIZE_CLASS: Record<'xs' | 'sm' | 'base' | 'lg', string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

const COLOR_CLASS: Record<'inherit' | 'white' | 'accent' | 'mutedFg', string> = {
  inherit: '',
  white: 'text-white',
  accent: 'text-[color:var(--accent)]',
  mutedFg: 'text-[color:var(--muted-fg)]',
};

const AVATAR_SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 24, md: 36, lg: 56 };

const BADGE_BG: Record<'accent' | 'neutral' | 'live', string> = {
  accent: 'bg-[color:var(--accent)] text-[color:var(--accent-fg)]',
  neutral: 'bg-black/80 text-white',
  live: 'bg-red-600 text-white',
};

function renderSlot(node: SlotNode, item: MediaItem, key?: string | number): ReactNode {
  switch (node.kind) {
    case 'text': {
      const value = item[node.source];
      // Allow strings, numbers, or React nodes — anything truthy renders.
      if (value === undefined || value === null || value === '') return null;
      const sizeClass = TEXT_SIZE_CLASS[node.size ?? 'sm'];
      const colorClass = COLOR_CLASS[node.color ?? 'inherit'];
      const lineClamp = node.maxLines === 1 ? 'truncate' : node.maxLines ? `line-clamp-${node.maxLines}` : '';
      const style: CSSProperties = node.weight ? { fontWeight: node.weight } : {};
      return (
        <span key={key} className={`${sizeClass} ${colorClass} ${lineClamp}`} style={Object.keys(style).length ? style : undefined}>
          {value as ReactNode}
        </span>
      );
    }
    case 'avatar': {
      const value = item[node.source];
      if (!value) return null;
      const size = AVATAR_SIZE_PX[node.size ?? 'md'];
      const radius = node.shape === 'square' ? '6px' : '50%';
      // Strings get rendered as <img>; ReactNodes pass through (legacy hosts
      // that pre-rendered an avatar component).
      if (typeof value === 'string') {
        return (
          <img
            key={key}
            src={value}
            alt=""
            className="object-cover shrink-0"
            style={{ width: size, height: size, borderRadius: radius }}
          />
        );
      }
      return <span key={key}>{value as ReactNode}</span>;
    }
    case 'badge': {
      const value = item[node.source];
      if (value === undefined || value === null || value === '') return null;
      const bg = BADGE_BG[node.color ?? 'neutral'];
      return (
        <span key={key} className={`rounded px-1.5 py-0.5 text-xs ${bg}`}>
          {value as ReactNode}
        </span>
      );
    }
    case 'row': {
      const gap = node.gap ?? 8;
      const align = node.align === 'center' ? 'items-center' : 'items-start';
      return (
        <div key={key} className={`flex min-w-0 ${align}`} style={{ gap: `${gap}px` }}>
          {node.children.map((child, i) => renderSlot(child, item, i))}
        </div>
      );
    }
    case 'column': {
      const gap = node.gap ?? 4;
      return (
        <div key={key} className="flex min-w-0 flex-col flex-1" style={{ gap: `${gap}px` }}>
          {node.children.map((child, i) => renderSlot(child, item, i))}
        </div>
      );
    }
  }
}

const OVERLAY_POSITION_CLASS: Record<OverlayPosition, string> = {
  tl: 'absolute top-2 left-2',
  tr: 'absolute top-2 right-2',
  bl: 'absolute bottom-2 left-2',
  br: 'absolute bottom-2 right-2',
  center: 'absolute inset-0 flex items-center justify-center',
  topBand: 'absolute top-0 left-0 right-0 p-3',
  bottomBand: 'absolute bottom-0 left-0 right-0 p-3',
};

function renderOverlay(node: OverlayNode, item: MediaItem, key: number): ReactNode {
  const positionClass = OVERLAY_POSITION_CLASS[node.position];
  const isBand = node.position === 'topBand' || node.position === 'bottomBand';
  const showGradient = node.gradient ?? isBand;
  // Bands lay their child nodes vertically; corners are inline.
  const contents = Array.isArray(node.contents) ? node.contents : [node.contents];
  const stackClass = isBand ? 'flex flex-col gap-1' : 'flex items-center gap-1';
  const gradientStyle: CSSProperties | undefined = showGradient
    ? {
        background:
          node.position === 'topBand'
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
            : node.position === 'bottomBand'
              ? 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
              : undefined,
      }
    : undefined;
  return (
    <div key={key} className={positionClass} style={gradientStyle}>
      <div className={stackClass}>
        {contents.map((child, i) => renderSlot(child, item, i))}
      </div>
    </div>
  );
}

/**
 * Host-agnostic media card. Takes a resolved CardPreset + a MediaItem and
 * renders the slot layout: cover (with letterbox bg via `--cover-bg` when
 * coverFit='contain') + badge corner + meta block (title, subtitle, stats,
 * timestamp, optional description). Visibility of each meta line is gated
 * by the preset's show* flags + master `hideMeta`.
 *
 * Host wraps this with their own VideoCard / TrackCard / EpisodeCard etc.
 * passing a MediaItem mapping their domain shape.
 */
export function MediaCard({
  item,
  preset,
  layout,
  overlay,
  onClick,
  href,
  outerClassName = '',
}: MediaCardProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hidden, setHidden] = useState(false);

  // Drop the card entirely if the cover image fails to load — most hosts
  // serve broken thumbnails for deleted/region-blocked content and would
  // rather hide than show a placeholder.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setHidden(true);
  }, []);
  if (hidden) return null;

  const hoverClass = HOVER_CLASS[preset.hoverEffect];
  const horizontal = preset.orientation === 'horizontal';
  const objectFitClass = preset.coverFit === 'contain' ? 'object-contain' : 'object-cover';

  const coverStyle: CSSProperties = {};
  if (preset.coverSaturate !== 1) coverStyle.filter = `saturate(${preset.coverSaturate})`;
  if (preset.coverScale !== 1) coverStyle.transform = `scale(${preset.coverScale})`;

  // ─── Slot-tree path ──────────────────────────────────────────────────
  // When a layout is provided (from theme.cardLayout or the preset's
  // default), walk the slot tree instead of the fixed render below.
  if (layout) {
    const layoutAspect = layout.cover?.aspect ?? preset.aspect;
    const layoutFit =
      layout.cover?.fit ?? (preset.coverFit === 'contain' ? 'contain' : 'cover');
    const layoutCoverSrc = layout.cover ? (item[layout.cover.source] as string | undefined) ?? item.cover : item.cover;

    const slotCover = layout.cover ? (
      <div
        className={`group relative overflow-hidden rounded-xl ${horizontal ? 'w-1/2 shrink-0' : ''}`}
        style={{
          aspectRatio: aspectRatioCss(layoutAspect),
          background: 'var(--cover-bg, color-mix(in srgb, var(--fg, #000) 20%, black))',
        }}
      >
        {layoutCoverSrc && (
          <img
            ref={imgRef}
            src={layoutCoverSrc}
            alt={(item.alt as string) ?? (item.title as string) ?? ''}
            loading="lazy"
            onError={() => setHidden(true)}
            className={`h-full w-full ${layoutFit === 'contain' ? 'object-contain' : 'object-cover'}`}
            style={Object.keys(coverStyle).length > 0 ? coverStyle : undefined}
          />
        )}
        {(layout.overlays ?? []).map((o, i) => renderOverlay(o, item, i))}
        {overlay}
      </div>
    ) : null;

    const above = (layout.above ?? []).length > 0 ? (
      <div className="flex flex-col gap-2">
        {layout.above!.map((n, i) => renderSlot(n, item, i))}
      </div>
    ) : null;
    const below = (layout.below ?? []).length > 0 ? (
      <div className="flex flex-col gap-1">
        {layout.below!.map((n, i) => renderSlot(n, item, i))}
      </div>
    ) : null;
    const aside = (layout.aside ?? []).length > 0 ? (
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        {layout.aside!.map((n, i) => renderSlot(n, item, i))}
      </div>
    ) : null;

    const layoutClass = horizontal ? 'flex gap-4' : 'flex flex-col gap-3';
    const cls = `group ${layoutClass} cursor-pointer ${hoverClass} ${outerClassName}`;
    const body = (
      <>
        {above}
        {slotCover}
        {below}
        {aside}
      </>
    );
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>
          {body}
        </a>
      );
    }
    return (
      <div onClick={onClick} className={cls}>
        {body}
      </div>
    );
  }
  // ─── End slot-tree path ──────────────────────────────────────────────

  const cover = (
    <div
      className={`relative overflow-hidden rounded-xl ${horizontal ? 'w-1/2 shrink-0' : ''}`}
      style={{
        aspectRatio: aspectRatioCss(preset.aspect),
        background: 'var(--cover-bg, color-mix(in srgb, var(--fg, #000) 20%, black))',
      }}
    >
      <img
        ref={imgRef}
        src={item.cover}
        alt={item.alt ?? item.title}
        loading="lazy"
        onError={() => setHidden(true)}
        className={`h-full w-full ${objectFitClass}`}
        style={Object.keys(coverStyle).length > 0 ? coverStyle : undefined}
      />
      {preset.showDuration && item.badge && (
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
          {item.badge}
        </span>
      )}
      {overlay}
    </div>
  );

  const showMetaLine =
    !preset.hideMeta && ((preset.showStats && item.stats) || (preset.showTimestamp && item.timestamp));

  const meta = (
    <div className={`flex gap-3 ${horizontal ? 'min-w-0 flex-1 items-start' : ''}`}>
      {!horizontal && item.avatar}
      <div className="min-w-0">
        <h3 className={`line-clamp-2 leading-snug font-medium ${horizontal ? 'text-base' : 'text-sm'}`}>
          {item.title}
        </h3>
        {item.subtitle && (
          <p className="mt-1 truncate text-xs text-[color:var(--muted-fg)]">
            {item.subtitle}
            {item.subtitleVerified && <span className="ml-1">✓</span>}
          </p>
        )}
        {showMetaLine && (
          <p className="mt-0.5 text-xs text-[color:var(--muted-fg)]">
            {preset.showStats && item.stats}
            {preset.showStats && preset.showTimestamp && item.stats && item.timestamp && ' · '}
            {preset.showTimestamp && item.timestamp}
          </p>
        )}
        {(preset.showDescription || horizontal) && item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[color:var(--muted-fg)]">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );

  const layoutClass = horizontal ? 'flex gap-4' : 'flex flex-col gap-3';
  const cls = `group ${layoutClass} cursor-pointer ${hoverClass} ${outerClassName}`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>
        {cover}
        {meta}
      </a>
    );
  }
  return (
    <div onClick={onClick} className={cls}>
      {cover}
      {meta}
    </div>
  );
}
