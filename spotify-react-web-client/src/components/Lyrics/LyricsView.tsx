import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useOptionalDispatch } from '@showcase/sdk';
import { useAppSelector } from '../../store/store';
import type { SpotifyTheme } from '../../personalization/host';
import './LyricsView.scss';

type Synced = Array<{ t: number; line: string }>;

const API_BASE = 'http://localhost:8787/api';

// Module-level cache so re-mounting the view (e.g. after toggling to
// /video and back) reuses already-fetched lyrics instead of going through
// idle → loading → ready again. Keyed by trackId — lyrics for a given
// track never change. The cache survives as long as the page stays open.
interface CachedLyrics {
  synced: Array<{ t: number; line: string }>;
  plain: string;
  found: boolean;
}
const lyricsClientCache = new Map<string, CachedLyrics>();

// ─── Translation (merge-translated, color-coded by language) ───
type Token = { text: string; fromTarget: boolean };
type TranslatedSynced = Array<{ t: number; line: string; tokens: Token[] }>;
const translationClientCache = new Map<string, TranslatedSynced>();

const LANG_OPTIONS: Array<{ code: string; label: string }> = [
  { code: '', label: 'Translate…' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
];

// Look up the active line index for a given playback time in seconds.
// Linear scan is fine — songs rarely have >200 lines.
function activeIndex(lines: Synced, nowSec: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.t <= nowSec) idx = i;
    else break;
  }
  return idx;
}

export const LyricsView: FC = () => {
  const playbackState = useAppSelector((s) => s.spotify.state);
  const track = playbackState?.track_window.current_track ?? null;
  const trackId = track?.id ?? null;
  const trackName = track?.name ?? '';
  const artistName = track?.artists?.[0]?.name ?? '';
  const durationSec = track?.duration_ms ? Math.round(track.duration_ms / 1000) : undefined;

  const [synced, setSynced] = useState<Synced>([]);
  const [plain, setPlain] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');
  const [nowSec, setNowSec] = useState<number>(0);
  const linesRef = useRef<HTMLDivElement | null>(null);

  // Translation target language is a PERSISTENT mode-level preference
  // (theme.captionLang) so chat can set it ("translate songs to english") and
  // it survives reloads. The dropdown writes the same field via update_theme.
  const config = useConfig();
  const dispatch = useOptionalDispatch();
  const lang = ((config.theme as SpotifyTheme).captionLang ?? '') as string;
  const [translation, setTranslation] = useState<TranslatedSynced | null>(null);
  const [translating, setTranslating] = useState<boolean>(false);

  // Fetch lyrics whenever the track changes — or hydrate instantly from
  // the client cache if we've seen this track before.
  useEffect(() => {
    if (!trackId || !artistName || !trackName) return;

    const cached = lyricsClientCache.get(trackId);
    if (cached) {
      setSynced(cached.synced);
      setPlain(cached.plain);
      setStatus(cached.found ? 'ready' : 'missing');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setSynced([]);
    setPlain('');
    const params = new URLSearchParams({ artist: artistName, track: trackName });
    if (durationSec) params.set('duration', String(durationSec));
    fetch(`${API_BASE}/lyrics?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { synced?: Synced; plain?: string; found?: boolean }) => {
        if (cancelled) return;
        const s = Array.isArray(data.synced) ? data.synced : [];
        const found = s.length > 0 || !!data.plain;
        const plainStr = data.plain ?? '';
        lyricsClientCache.set(trackId, { synced: s, plain: plainStr, found });
        setSynced(s);
        setPlain(plainStr);
        setStatus(found ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, artistName, trackName, durationSec]);

  // Fetch the color-coded translation when a target language is picked.
  // Cached per (track, lang); shows original while translating.
  useEffect(() => {
    setTranslation(null);
    if (!lang || !trackId || !artistName || !trackName || synced.length === 0) return;

    const key = `${trackId}|${lang}`;
    const cached = translationClientCache.get(key);
    if (cached) { setTranslation(cached); return; }

    let cancelled = false;
    setTranslating(true);
    const params = new URLSearchParams({ artist: artistName, track: trackName, lang });
    if (durationSec) params.set('duration', String(durationSec));
    fetch(`${API_BASE}/lyrics/translate?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { synced?: TranslatedSynced }) => {
        if (cancelled) return;
        const s = Array.isArray(data.synced) ? data.synced : [];
        translationClientCache.set(key, s);
        setTranslation(s);
      })
      .catch(() => { if (!cancelled) setTranslation(null); })
      .finally(() => { if (!cancelled) setTranslating(false); });
    return () => { cancelled = true; };
  }, [lang, trackId, artistName, trackName, durationSec, synced.length]);

  // Tick playback position. PlaybackState's `position` updates on state
  // events (~every 300ms+); we extrapolate between events with a local
  // timer so highlights advance smoothly while playing.
  useEffect(() => {
    if (!playbackState) return;
    const basePos = playbackState.position / 1000;
    const baseAt = performance.now();
    const paused = playbackState.paused;
    setNowSec(basePos);
    if (paused) return;
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - baseAt) / 1000;
      setNowSec(basePos + elapsed);
    }, 150);
    return () => window.clearInterval(id);
  }, [playbackState]);

  const active = useMemo(() => activeIndex(synced, nowSec), [synced, nowSec]);

  // Auto-scroll the active line into view.
  useEffect(() => {
    if (active < 0 || !linesRef.current) return;
    const el = linesRef.current.querySelector<HTMLDivElement>(
      `[data-lyric-idx="${active}"]`,
    );
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [active]);

  if (!track) {
    return (
      <div className='lyrics-view lyrics-view--empty'>
        <p>Play a song to see lyrics.</p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className='lyrics-view lyrics-view--empty'>
        <p>Loading lyrics for "{trackName}"…</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className='lyrics-view lyrics-view--empty'>
        <p>No lyrics found for "{trackName}" by {artistName}.</p>
      </div>
    );
  }

  return (
    <div className='lyrics-view' ref={linesRef}>
      <div className='lyrics-view__header'>
        <h2>{trackName}</h2>
        <p>{artistName}</p>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={lang}
            onChange={(e) => dispatch?.({ op: 'update_theme', patch: { captionLang: e.target.value } })}
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.code} value={o.code} style={{ color: '#000' }}>{o.label}</option>
            ))}
          </select>
          {translating && <span style={{ fontSize: 12, opacity: 0.6 }}>translating…</span>}
        </div>
      </div>
      {synced.length > 0 ? (
        <div className='lyrics-view__lines'>
          {synced.map((line, i) => (
            <div
              key={i}
              data-lyric-idx={i}
              className={`lyrics-view__line ${i === active ? 'is-active' : i < active ? 'is-past' : ''}`}
            >
              <div>{line.line || ' '}</div>
              {lang && (translation?.[i]?.tokens?.length ?? 0) > 0 && (
                <div style={{ fontSize: '0.82em', opacity: 0.82, marginTop: 2 }}>
                  {(translation?.[i]?.tokens ?? []).map((tok, j) => (
                    <span key={j} style={tok.fromTarget ? { color: '#1db954', fontWeight: 600 } : undefined}>{tok.text}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <pre className='lyrics-view__plain'>{plain}</pre>
      )}
    </div>
  );
};
