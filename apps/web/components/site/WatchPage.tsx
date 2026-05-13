'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Video } from '@showcase/shared';
import { usePageStore } from '@/lib/store';
import { Avatar } from '@/components/templates/Avatar';

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

interface YtComment {
  id: string;
  author: string;
  authorAvatar: string;
  authorVerified: boolean;
  text: string;
  postedAgo: string;
  likes: string;
  replyCount: string;
  isPinned: boolean;
  isCreator: boolean;
}

type CommentsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; comments: YtComment[]; total: string | null }
  | { status: 'error'; reason: string };

interface YtVideoInfo {
  title: string;
  description: string;
  viewCount: number;
  likeCount: number;
  postedAgo: string;
  channel: {
    name: string;
    avatar: string;
    verified: boolean;
    subscriberCount: number;
    subscriberCountText: string;
  };
}

type InfoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; info: YtVideoInfo }
  | { status: 'error'; reason: string };

// Compact suggested-video card on the right column. Clicking switches the
// player without leaving the watch view.
function SuggestionCard({ video }: { video: Video }) {
  const { setWatching } = usePageStore();
  return (
    <button
      type="button"
      onClick={() => setWatching(video.id, video.title)}
      className="flex w-full gap-2 rounded-lg p-1 text-left transition-colors hover:bg-[color:var(--muted)]"
    >
      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md bg-[color:var(--muted)]">
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt={video.title}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            className="h-full w-full object-cover"
          />
        )}
        {video.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] text-white">
            {video.duration}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-sm font-medium leading-snug">{video.title}</h4>
        <p className="mt-1 truncate text-xs text-[color:var(--muted-fg)]">
          {video.channel.name}
          {video.channel.verified && <span className="ml-1">✓</span>}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--muted-fg)]">
          {video.views > 0 && `${formatViews(video.views)} views`}
          {video.views > 0 && video.postedAgo && ' · '}
          {video.postedAgo}
        </p>
      </div>
    </button>
  );
}

export function WatchPage() {
  const { config, watchingId, watchingTitle, setWatching } = usePageStore();

  // Pull suggestions from whatever section currently holds videos
  // (VideoGrid in normal mode, or any RecommendedRow). Exclude currentvideo.
  const suggestions: Video[] = useMemo(() => {
    if (!watchingId) return [];
    const grid = config.sections.find((s) => s.type === 'VideoGrid');
    const all = grid && grid.type === 'VideoGrid' ? grid.props.videos : [];
    return all.filter((v) => v.id !== watchingId).slice(0, 20);
  }, [config.sections, watchingId]);

  const currentVideo: Video | undefined = useMemo(() => {
    if (!watchingId) return undefined;
    for (const s of config.sections) {
      if (s.type === 'VideoGrid' || s.type === 'RecommendedRow' || s.type === 'ContinueWatchingRow') {
        const found = s.props.videos.find((v) => v.id === watchingId);
        if (found) return found;
      }
    }
    return undefined;
  }, [config.sections, watchingId]);

  const [commentsState, setCommentsState] = useState<CommentsState>({ status: 'idle' });
  const [infoState, setInfoState] = useState<InfoState>({ status: 'idle' });
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Fetch the per-video info (description, subs, views, posted-ago) via the
  // youtubei adapter. Same cancel-on-switch pattern as comments.
  useEffect(() => {
    setDescriptionExpanded(false);
    if (!watchingId) {
      setInfoState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setInfoState({ status: 'loading' });
    fetch(`/api/yt/info?v=${encodeURIComponent(watchingId)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { reason?: string };
          setInfoState({ status: 'error', reason: data.reason ?? `HTTP ${r.status}` });
          return;
        }
        const data = (await r.json()) as { ok?: boolean; info?: YtVideoInfo; reason?: string };
        if (!data.ok || !data.info) {
          setInfoState({ status: 'error', reason: data.reason ?? 'unknown error' });
          return;
        }
        setInfoState({ status: 'ok', info: data.info });
      })
      .catch((err) => {
        if (cancelled) return;
        setInfoState({ status: 'error', reason: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [watchingId]);

  // Fetch real comments via the youtubei adapter when a new video starts.
  // Cancels stale fetches if the visitor switches videos mid-flight.
  useEffect(() => {
    if (!watchingId) {
      setCommentsState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setCommentsState({ status: 'loading' });
    fetch(`/api/yt/comments?v=${encodeURIComponent(watchingId)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { reason?: string };
          setCommentsState({ status: 'error', reason: data.reason ?? `HTTP ${r.status}` });
          return;
        }
        const data = (await r.json()) as { ok?: boolean; comments?: YtComment[]; total?: string | null; reason?: string };
        if (!data.ok || !Array.isArray(data.comments)) {
          setCommentsState({ status: 'error', reason: data.reason ?? 'unknown error' });
          return;
        }
        setCommentsState({ status: 'ok', comments: data.comments, total: data.total ?? null });
      })
      .catch((err) => {
        if (cancelled) return;
        setCommentsState({ status: 'error', reason: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [watchingId]);

  if (!watchingId) return null;

  const embedSrc = `https://www.youtube.com/embed/${encodeURIComponent(watchingId)}?autoplay=1&rel=0`;

  return (
    <div className="px-6 py-4">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left column: player + metadata */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              src={embedSrc}
              title={watchingTitle ?? 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>

          {(() => {
            // Prefer real watch-page info; fall back to whatever the lockup
            // entry already had on the home feed so the header doesn't flash
            // blank while /api/yt/info is in flight.
            const info = infoState.status === 'ok' ? infoState.info : null;
            const title = info?.title || watchingTitle || currentVideo?.title || 'Now playing';
            const channelName = info?.channel.name || currentVideo?.channel.name || 'YouTube';
            const channelAvatar = info?.channel.avatar || currentVideo?.channel.avatar || '';
            const channelVerified = info?.channel.verified || currentVideo?.channel.verified || false;
            const subscriberLine =
              info?.channel.subscriberCountText ||
              (info && info.channel.subscriberCount > 0
                ? `${formatViews(info.channel.subscriberCount)} subscribers`
                : currentVideo && currentVideo.channel.subscriberCount > 0
                  ? `${formatViews(currentVideo.channel.subscriberCount)} subscribers`
                  : infoState.status === 'loading'
                    ? 'Loading…'
                    : '');
            const views = info?.viewCount ?? currentVideo?.views ?? 0;
            const postedAgo = info?.postedAgo || currentVideo?.postedAgo || '';
            const likes = info?.likeCount ?? 0;

            return (
              <div>
                <h1 className="text-xl font-semibold leading-tight">{title}</h1>
                {(views > 0 || postedAgo) && (
                  <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                    {views > 0 && `${formatViews(views)} views`}
                    {views > 0 && postedAgo && ' · '}
                    {postedAgo}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={channelName} src={channelAvatar} size="xl" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {channelName}
                        {channelVerified && <span className="ml-1">✓</span>}
                      </p>
                      {subscriberLine && (
                        <p className="truncate text-xs text-[color:var(--muted-fg)]">
                          {subscriberLine}
                        </p>
                      )}
                    </div>
                    <button className="ml-2 rounded-full bg-[color:var(--fg)] px-4 py-1.5 text-sm font-medium text-[color:var(--bg)]">
                      Subscribe
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {likes > 0 && (
                      <span className="rounded-full bg-[color:var(--muted)] px-4 py-1.5 text-sm">
                        ♥ {formatViews(likes)}
                      </span>
                    )}
                    <button
                      onClick={() => setWatching(null)}
                      className="rounded-full bg-[color:var(--muted)] px-4 py-1.5 text-sm hover:bg-[color:var(--border)]"
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {(() => {
            const info = infoState.status === 'ok' ? infoState.info : null;
            const description = info?.description || currentVideo?.description || '';
            if (infoState.status === 'loading' && !description) {
              return (
                <div className="rounded-xl bg-[color:var(--muted)] p-4 text-sm text-[color:var(--muted-fg)]">
                  Loading description…
                </div>
              );
            }
            if (!description) return null;
            return (
              <div className="rounded-xl bg-[color:var(--muted)] p-4 text-sm text-[color:var(--fg)]">
                <p
                  className={`whitespace-pre-wrap ${descriptionExpanded ? '' : 'line-clamp-3'}`}
                >
                  {description}
                </p>
                {description.length > 200 && (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((v) => !v)}
                    className="mt-2 text-xs font-medium text-[color:var(--muted-fg)] hover:text-[color:var(--fg)]"
                  >
                    {descriptionExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            );
          })()}

          <section className="mt-2">
            <h2 className="mb-4 flex items-baseline gap-3 text-base font-semibold">
              <span>
                {commentsState.status === 'ok'
                  ? (commentsState.total ?? `${commentsState.comments.length}`)
                  : 'Comments'}
              </span>
            </h2>
            <div className="mb-6 flex items-start gap-3">
              <Avatar name="You" size="md" />
              <input
                type="text"
                placeholder="Add a comment..."
                className="flex-1 border-b border-[color:var(--border)] bg-transparent pb-2 text-sm outline-none focus:border-[color:var(--fg)]"
              />
            </div>
            {commentsState.status === 'loading' && (
              <p className="text-sm text-[color:var(--muted-fg)]">Loading comments…</p>
            )}
            {commentsState.status === 'error' && (
              <p className="text-sm text-[color:var(--muted-fg)]">
                Comments unavailable for this video.
                <span className="ml-1 opacity-60">({commentsState.reason})</span>
              </p>
            )}
            {commentsState.status === 'ok' && commentsState.comments.length === 0 && (
              <p className="text-sm text-[color:var(--muted-fg)]">No comments yet.</p>
            )}
            {commentsState.status === 'ok' && commentsState.comments.length > 0 && (
              <ul className="flex flex-col gap-5">
                {commentsState.comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <Avatar name={c.author} src={c.authorAvatar} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">
                          {c.author}
                          {c.authorVerified && <span className="ml-1 text-[color:var(--muted-fg)]">✓</span>}
                          {c.isCreator && (
                            <span className="ml-2 rounded bg-[color:var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted-fg)]">
                              Creator
                            </span>
                          )}
                          {c.isPinned && (
                            <span className="ml-2 rounded bg-[color:var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted-fg)]">
                              Pinned
                            </span>
                          )}
                        </span>
                        {c.postedAgo && (
                          <span className="text-xs text-[color:var(--muted-fg)]">{c.postedAgo}</span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-[color:var(--muted-fg)]">
                        {c.likes && (
                          <span className="flex items-center gap-1">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                              <path d="M2 9h4v12H2zm20 2.5c0-.83-.67-1.5-1.5-1.5h-5.81l.92-4.65A2 2 0 0 0 13.66 3l-5.66 6v12h11.55a2 2 0 0 0 2-1.7l1.45-7.8z" />
                            </svg>
                            {c.likes}
                          </span>
                        )}
                        <button type="button" className="font-medium hover:text-[color:var(--fg)]">
                          Reply
                        </button>
                        {c.replyCount && (
                          <span className="text-[color:var(--accent)]">{c.replyCount}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column: up next */}
        <aside className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-fg)]">
            Up next
          </h2>
          <div className="flex flex-col gap-2">
            {suggestions.map((v) => (
              <SuggestionCard key={v.id} video={v} />
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-[color:var(--muted-fg)]">No suggestions yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
