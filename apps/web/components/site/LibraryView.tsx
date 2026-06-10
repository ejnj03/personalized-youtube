'use client';

import { useEffect, useState } from 'react';
import type { Video } from '@showcase/shared';
import type { YtPlaylist, YtPlaylistInfo } from '@/lib/innertube/client';
import { usePageStore } from '@/lib/store';
import { Avatar } from '@/components/templates/Avatar';

type LibState =
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'ok'; playlists: YtPlaylist[]; history: Video[] };

type OpenState =
  | { status: 'idle' }
  | { status: 'loading'; playlist: YtPlaylist }
  | { status: 'ok'; playlist: YtPlaylist; info: YtPlaylistInfo; videos: Video[] }
  | { status: 'error'; playlist: YtPlaylist; reason: string };

// YouTube's playlists-page filter row. Visual only — there's no metadata to
// filter the small set against, so they read as the familiar chrome.
const FILTER_CHIPS = ['Playlists', 'Music', 'Mixes', 'Albums', 'Podcasts', 'Courses', 'Owned', 'Saved'];

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function subtitleFor(p: YtPlaylist): string {
  if (p.kind === 'liked' || p.kind === 'watch_later') return 'Private • Playlist';
  return 'Playlist';
}

function PlaylistCard({ playlist, onOpen }: { playlist: YtPlaylist; onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onOpen} className="group relative block">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[color:var(--muted)]">
          {/* stacked-playlist edges (YouTube look) */}
          <span className="pointer-events-none absolute -top-1.5 left-2 right-2 h-2 rounded-t-lg bg-[color:var(--muted-fg)]/30" />
          {playlist.thumbnail && (
            <img
              src={playlist.thumbnail}
              alt={playlist.title}
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              className="h-full w-full object-cover"
            />
          )}
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M4 6h11v2H4zm0 4h11v2H4zm0 4h7v2H4zm13-4l5 3-5 3z" />
            </svg>
            {playlist.videoCount > 0 ? `${playlist.videoCount} videos` : ''}
          </span>
        </div>
      </button>
      <div className="min-w-0">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug hover:underline">{playlist.title}</h3>
        </button>
        <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{subtitleFor(playlist)}</p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-1 text-xs text-[color:var(--muted-fg)] hover:text-[color:var(--fg)]"
        >
          View full playlist
        </button>
      </div>
    </div>
  );
}

// One numbered row in the opened-playlist video list.
function PlaylistRow({ index, video }: { index: number; video: Video }) {
  const { setWatching } = usePageStore();
  return (
    <button
      type="button"
      onClick={() => setWatching(video.id, video.title)}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[color:var(--muted)]"
    >
      <span className="w-5 shrink-0 text-center text-xs text-[color:var(--muted-fg)]">{index}</span>
      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-[color:var(--muted)]">
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
          {video.views > 0 && ` • ${formatViews(video.views)} views`}
          {video.postedAgo && ` • ${video.postedAgo}`}
        </p>
      </div>
    </button>
  );
}

function PlaylistDetail({
  open,
  onBack,
}: {
  open: Extract<OpenState, { status: 'loading' | 'ok' | 'error' }>;
  onBack: () => void;
}) {
  const { setWatching } = usePageStore();
  const title = open.status === 'ok' ? (open.info.title || open.playlist.title) : open.playlist.title;
  const thumb = open.status === 'ok' ? (open.info.thumbnail || open.playlist.thumbnail) : open.playlist.thumbnail;

  return (
    <div className="px-6 py-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--muted)] px-3 py-1.5 text-sm hover:bg-[color:var(--border)]"
      >
        ← Library
      </button>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left: sticky info panel with a thumbnail-sampled gradient backdrop */}
        <aside className="self-start lg:sticky lg:top-4">
          <div className="relative overflow-hidden rounded-2xl p-5 text-white">
            {thumb && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${thumb})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(36px) saturate(1.5)',
                  transform: 'scale(1.3)',
                }}
              />
            )}
            <div aria-hidden className="absolute inset-0 bg-black/55" />
            <div className="relative">
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black/30">
                {thumb && <img src={thumb} alt={title} className="h-full w-full object-cover" />}
              </div>
              <h1 className="mt-4 text-2xl font-bold leading-tight">{title}</h1>
              {open.status === 'ok' && (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    {open.info.author && <Avatar name={open.info.author} src={open.info.authorAvatar} size="sm" />}
                    <span className="text-sm font-medium">{open.info.author ? `by ${open.info.author}` : ''}</span>
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    Playlist
                    {open.info.totalItems > 0 && ` • ${open.info.totalItems} videos`}
                    {open.info.views && ` • ${open.info.views}`}
                  </p>
                </>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => open.status === 'ok' && open.videos[0] && setWatching(open.videos[0].id, open.videos[0].title)}
                  disabled={open.status !== 'ok' || open.videos.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M8 5v14l11-7z" /></svg>
                  Play all
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: numbered video rows */}
        <div className="min-w-0">
          {open.status === 'loading' && <p className="text-sm text-[color:var(--muted-fg)]">Loading playlist…</p>}
          {open.status === 'error' && (
            <p className="text-sm text-[color:var(--muted-fg)]">
              Couldn’t load this playlist. <span className="opacity-60">({open.reason})</span>
            </p>
          )}
          {open.status === 'ok' && open.videos.length === 0 && (
            <p className="text-sm text-[color:var(--muted-fg)]">This playlist is empty.</p>
          )}
          {open.status === 'ok' && open.videos.length > 0 && (
            <ol className="flex flex-col gap-1">
              {open.videos.map((v, i) => (
                <li key={`${v.id}-${i}`}>
                  <PlaylistRow index={i + 1} video={v} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

export function LibraryView() {
  const [state, setState] = useState<LibState>({ status: 'loading' });
  const [open, setOpen] = useState<OpenState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch('/api/yt/library')
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { reason?: string };
          setState({ status: 'error', reason: data.reason ?? `HTTP ${r.status}` });
          return;
        }
        const data = (await r.json()) as { ok?: boolean; playlists?: YtPlaylist[]; history?: Video[]; reason?: string };
        if (!data.ok) {
          setState({ status: 'error', reason: data.reason ?? 'unavailable' });
          return;
        }
        setState({ status: 'ok', playlists: data.playlists ?? [], history: data.history ?? [] });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', reason: (err as Error).message });
      });
    return () => { cancelled = true; };
  }, []);

  function openPlaylist(playlist: YtPlaylist): void {
    setOpen({ status: 'loading', playlist });
    fetch(`/api/yt/playlist?id=${encodeURIComponent(playlist.id)}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { reason?: string };
          setOpen({ status: 'error', playlist, reason: data.reason ?? `HTTP ${r.status}` });
          return;
        }
        const data = (await r.json()) as { ok?: boolean; info?: YtPlaylistInfo; videos?: Video[]; reason?: string };
        if (!data.ok || !Array.isArray(data.videos) || !data.info) {
          setOpen({ status: 'error', playlist, reason: data.reason ?? 'unavailable' });
          return;
        }
        setOpen({ status: 'ok', playlist, info: data.info, videos: data.videos });
      })
      .catch((err) => setOpen({ status: 'error', playlist, reason: (err as Error).message }));
  }

  if (open.status !== 'idle') {
    return <PlaylistDetail open={open} onBack={() => setOpen({ status: 'idle' })} />;
  }

  return (
    <div className="px-6 py-5">
      <h1 className="mb-4 text-2xl font-bold">Playlists</h1>

      {/* Filter chips (visual chrome, matches YouTube's playlists page) */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--muted)] px-3 py-1.5 text-sm font-medium">
          Recently added
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M7 10l5 5 5-5z" /></svg>
        </span>
        {FILTER_CHIPS.map((c, i) => (
          <span
            key={c}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              i === 0
                ? 'bg-[color:var(--fg)] text-[color:var(--bg)]'
                : 'bg-[color:var(--muted)] text-[color:var(--fg)]'
            }`}
          >
            {c}
          </span>
        ))}
      </div>

      {state.status === 'loading' && (
        <p className="text-sm text-[color:var(--muted-fg)]">Loading your playlists…</p>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl bg-[color:var(--muted)] p-5 text-sm text-[color:var(--muted-fg)]">
          Your library is unavailable. <span className="opacity-60">({state.reason})</span>
          <p className="mt-1">This page needs a signed-in YouTube account (Chrome cookies).</p>
        </div>
      )}

      {state.status === 'ok' && (
        state.playlists.length === 0 ? (
          <p className="text-sm text-[color:var(--muted-fg)]">No saved playlists yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {state.playlists.map((p) => (
              <PlaylistCard key={p.id} playlist={p} onOpen={() => openPlaylist(p)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
