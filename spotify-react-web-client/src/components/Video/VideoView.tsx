import { FC, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../store/store';
import './VideoView.scss';

const API_BASE = 'http://localhost:8787/api';
const SYNC_TOLERANCE_SEC = 1.0;

interface LookupResponse {
  videoId?: string | null;
  streamUrl?: string | null;
  found?: boolean;
}

// Client-side cache so toggling away to /lyrics and back doesn't re-fetch.
// streamUrl is signed and expires; assume ~5h validity to align with the
// server's stream cache TTL.
interface CachedVideo { streamUrl: string; cachedAt: number; }
const STREAM_CLIENT_TTL_MS = 5 * 60 * 60 * 1000;
const videoClientCache = new Map<string, CachedVideo>();

export const VideoView: FC = () => {
  const playbackState = useAppSelector((s) => s.spotify.state);
  const track = playbackState?.track_window.current_track ?? null;
  const trackId = track?.id ?? null;
  const trackName = track?.name ?? '';
  const artistName = track?.artists?.[0]?.name ?? '';

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch streamUrl when the track changes — hydrate from client cache
  // if we've resolved this track recently and the signed URL is still
  // within its TTL.
  useEffect(() => {
    if (!trackId || !artistName || !trackName) return;

    const cached = videoClientCache.get(trackId);
    if (cached && Date.now() - cached.cachedAt < STREAM_CLIENT_TTL_MS) {
      setStreamUrl(cached.streamUrl);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setStreamUrl(null);
    const params = new URLSearchParams({ artist: artistName, track: trackName });
    fetch(`${API_BASE}/music-video?${params.toString()}`)
      .then((r) => r.json())
      .then((data: LookupResponse) => {
        if (cancelled) return;
        if (data.streamUrl) {
          videoClientCache.set(trackId, { streamUrl: data.streamUrl, cachedAt: Date.now() });
          setStreamUrl(data.streamUrl);
          setStatus('ready');
        } else {
          setStatus('missing');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, artistName, trackName]);

  // Sync loop: every 500ms align <video>.currentTime to spotify position,
  // and mirror play/pause state from Spotify. <video> is always muted —
  // Spotify is the audio source.
  useEffect(() => {
    if (!playbackState || !streamUrl) return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const basePos = playbackState.position / 1000;
      const drift = Math.abs(v.currentTime - basePos);
      if (drift > SYNC_TOLERANCE_SEC) v.currentTime = basePos;
      if (playbackState.paused && !v.paused) v.pause();
      if (!playbackState.paused && v.paused) v.play().catch(() => {});
    }, 500);
    return () => window.clearInterval(id);
  }, [playbackState, streamUrl]);

  // Ensure muted + play on mount once the stream is set. <video> won't
  // autoplay with sound; muted autoplay always passes Chrome's policy.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !streamUrl) return;
    v.muted = true;
    v.play().catch(() => {
      /* user-gesture not yet granted; sync loop will catch up */
    });
  }, [streamUrl]);

  if (!track) {
    return (
      <div className='video-view video-view--empty'>
        <p>Play a song to see its music video.</p>
      </div>
    );
  }
  if (status === 'loading') {
    return (
      <div className='video-view video-view--empty'>
        <p>Finding music video for "{trackName}"…</p>
      </div>
    );
  }
  if (status === 'missing' || !streamUrl) {
    return (
      <div className='video-view video-view--empty'>
        <p>No music video found for "{trackName}" by {artistName}.</p>
      </div>
    );
  }

  return (
    <div className='video-view'>
      <div className='video-view__stage'>
        <video
          ref={videoRef}
          src={streamUrl}
          muted
          playsInline
          autoPlay
          className='video-view__player'
        />
      </div>
    </div>
  );
};
