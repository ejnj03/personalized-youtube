'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaptionTrack } from '@showcase/sdk/core';
import { usePageStore } from '@/lib/store';

// ─── YouTube IFrame API loader (singleton) ───────────────────────────────
// The plain embed iframe can't report playback time; the IFrame API can. Load
// the script once and resolve when window.YT is ready.
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as unknown as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  });
  return ytApiPromise;
}

// Text of the cue active at time `t` (last cue whose start <= t). Binary search
// since cues are sorted — aligns native / translated tracks by time.
function cueTextAt(track: CaptionTrack, t: number): string {
  const cues = track.cues;
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid]!.start <= t + 0.05) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? cues[ans]!.text : '';
}

// Live caption overlay — primary language large, secondary smaller beneath.
// Languages come from the mode's SubtitleTrack section (same config the
// transcript panel reads); cues are picked by the player's current time.
function CaptionOverlay({ videoId, currentTime }: { videoId: string; currentTime: number }) {
  const { config } = usePageStore();

  const langs = useMemo(() => {
    const st = config.sections.find(
      (s) => s.type === 'SubtitleTrack' && (s.props as { visible?: boolean }).visible !== false,
    );
    if (!st) return [];
    const p = st.props as { primary?: string; secondary?: string };
    return [p.primary, p.secondary].filter((x): x is string => typeof x === 'string' && x.length > 0);
  }, [config.sections]);
  const langsKey = langs.join(',');

  const [tracks, setTracks] = useState<CaptionTrack[]>([]);
  useEffect(() => {
    if (langs.length === 0) { setTracks([]); return; }
    let cancelled = false;
    fetch(`/api/yt/captions?v=${encodeURIComponent(videoId)}&langs=${encodeURIComponent(langsKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; tracks?: CaptionTrack[] } | null) => {
        if (!cancelled && d?.ok && Array.isArray(d.tracks)) setTracks(d.tracks);
      })
      .catch(() => { /* overlay just stays hidden */ });
    return () => { cancelled = true; };
  }, [videoId, langsKey, langs.length]);

  if (langs.length === 0 || tracks.length === 0) return null;

  const primary = tracks[0] ? cueTextAt(tracks[0], currentTime) : '';
  const secondary = tracks[1] ? cueTextAt(tracks[1], currentTime) : '';
  if (!primary && !secondary) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[9%] z-20 flex flex-col items-center gap-1.5 px-[5%] text-center">
      {primary && (
        <span
          className="rounded-md bg-black/70 px-3 py-1 text-[clamp(1rem,2.7vw,1.75rem)] font-semibold leading-tight text-white"
          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
        >
          {primary}
        </span>
      )}
      {secondary && (
        <span
          className="rounded bg-black/55 px-2.5 py-0.5 text-[clamp(0.8rem,1.8vw,1.15rem)] leading-tight text-white/90"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
        >
          {secondary}
        </span>
      )}
    </div>
  );
}

interface YtPlayer {
  loadVideoById: (id: string) => void;
  getCurrentTime: () => number;
  destroy: () => void;
}

// Player surface: owns the embed through the IFrame API so we can read
// playback time and drive the live caption overlay.
export function WatchPlayer({ videoId, title }: { videoId: string; title: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);

  // Create the player once; poll currentTime while it lives.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    void loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || playerRef.current) return;
      const YT = (window as unknown as { YT: { Player: new (el: Element, opts: unknown) => YtPlayer } }).YT;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        // cc_load_policy: 0 → don't force YouTube's own CC on, so our dual
        // overlay isn't doubled by the native captions.
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, cc_load_policy: 0 },
        events: {
          onReady: () => {
            setReady(true);
            const loop = () => {
              if (cancelled) return;
              try {
                const t = playerRef.current?.getCurrentTime?.();
                if (typeof t === 'number') setTime(t);
              } catch { /* not ready yet */ }
              timer = setTimeout(loop, 250);
            };
            loop();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
    // create once — video switches are handled by loadVideoById below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch videos without tearing down the player.
  useEffect(() => {
    if (ready && playerRef.current) {
      try { playerRef.current.loadVideoById(videoId); } catch { /* ignore */ }
    }
  }, [videoId, ready]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black" title={title ?? undefined}>
      <div ref={mountRef} className="h-full w-full" />
      <CaptionOverlay videoId={videoId} currentTime={time} />
    </div>
  );
}
