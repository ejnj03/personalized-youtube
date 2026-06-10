'use client';

import type { PageConfig, Video } from '@showcase/shared';
import { cardPresetCatalog } from '@showcase/shared';
import { MediaCard, mentionInChat, type MediaItem } from '@showcase/sdk';
import { resolveCardPreset } from '@showcase/sdk/core';
import { usePageStore } from '@/lib/store';
import { Avatar } from './Avatar';

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function VideoCard({
  video,
  config,
  watchedFraction,
  cardPresetOverride,
}: {
  video: Video;
  config: PageConfig;
  watchedFraction?: number;
  /** Per-section override of theme.cardPreset (RecommendedRow / VideoGrid). */
  cardPresetOverride?: string;
}) {
  const themeAny = config.theme as any;
  const preset = resolveCardPreset(
    cardPresetCatalog,
    themeAny.cardPreset ?? 'video_card',
    themeAny.cardOverrides ?? {},
    cardPresetOverride,
  );
  // Effective slot-tree layout. Agent-emitted `theme.cardLayout` wins; if
  // absent, fall back to the chosen preset's own default layout (e.g.
  // picking `square_card` paints SQUARE_CARD_LAYOUT — avatar on top, cover,
  // title below) so the catalog's archetype is meaningfully complete. If
  // even that's missing, MediaCard uses the legacy fixed render.
  const cardLayout = themeAny.cardLayout ?? preset.layout;

  const isWatched = video.watched === true;
  const watchedMode = config.filter.showWatchedOverlay && isWatched;

  // Map domain shape → MediaItem. When the agent sets a custom cardLayout,
  // its slot tree references string fields like 'avatar' / 'channelAvatar'
  // by source name — pass URL strings AS WELL AS the rich Avatar component
  // so both legacy (ReactNode) and layout (URL) paths work.
  const item: MediaItem = {
    cover: video.thumbnail,
    alt: video.title,
    title: video.title,
    subtitle: video.channel.name,
    subtitleVerified: video.channel.verified,
    avatar: cardLayout
      ? video.channel.avatar          // layout path uses URL string
      : <Avatar name={video.channel.name} src={video.channel.avatar} size="md" />,
    badge: video.duration,
    stats: `${formatViews(video.views)} views`,
    timestamp: video.postedAgo,
    description: video.description,
  };
  // Extra fields that the agent's slot tree may reference by source name
  // (channelAvatar / channel / duration). Index signature accepts these
  // without needing to widen the typed MediaItem.
  item.channelAvatar = video.channel.avatar;
  item.channel = video.channel.name;
  item.duration = video.duration;

  const overlay = (
    <>
      {/* Hover affordance: @-mention this video into the chat (→ pin, etc.). */}
      <button
        type="button"
        aria-label={`Mention "${video.title}" in chat`}
        title="Mention in chat"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          mentionInChat(video.title, {
            id: video.id,
            title: video.title,
            channel: video.channel.name,
          });
        }}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-sm font-semibold text-white opacity-0 transition-opacity hover:bg-black/90 group-hover:opacity-100"
      >
        @
      </button>
      {watchedMode && (
        <span className="absolute left-2 top-2 rounded bg-black/85 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/80">
          Watched
        </span>
      )}
      {typeof watchedFraction === 'number' && watchedFraction > 0 && (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-[color:var(--accent)]"
          style={{ width: `${Math.min(100, Math.max(0, watchedFraction * 100))}%` }}
        />
      )}
    </>
  );

  const { setWatching } = usePageStore();
  const watchHref = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
  const watchedDim = watchedMode ? 'opacity-40' : '';

  function onCardClick(e: React.MouseEvent): void {
    // Cmd/Ctrl/Shift-click or middle-click → native open-in-new-tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    setWatching(video.id, video.title);
  }

  return (
    <MediaCard
      item={item}
      preset={preset}
      layout={cardLayout}
      overlay={overlay}
      href={watchHref}
      onClick={onCardClick}
      outerClassName={watchedDim}
    />
  );
}
