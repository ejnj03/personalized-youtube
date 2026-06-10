'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CaptionTrack } from '@showcase/sdk/core';
import { usePageStore } from '@/lib/store';

const LANG_NAMES: Record<string, string> = {
  en: 'English', ko: '한국어', ja: '日本語', es: 'Español', fr: 'Français',
  de: 'Deutsch', it: 'Italiano', pt: 'Português', ru: 'Русский', zh: '中文',
  ar: 'العربية', hi: 'हिन्दी', vi: 'Tiếng Việt', th: 'ไทย', id: 'Bahasa',
};
const langLabel = (code: string): string => LANG_NAMES[code] ?? code.toUpperCase();

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'ok'; tracks: CaptionTrack[] };

// Dual/multi-language transcript for the watch page. Languages come from a
// visible SubtitleTrack section (primary + secondary), so chat drives it:
// "dual subtitles in korean and english" → the panel shows both columns.
// P1: a scrollable index-aligned transcript (no player time-sync yet).
export function TranscriptPanel({ videoId }: { videoId: string }) {
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
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (langs.length === 0) return;
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(`/api/yt/captions?v=${encodeURIComponent(videoId)}&langs=${encodeURIComponent(langsKey)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { reason?: string };
          setState({ status: 'error', reason: d.reason ?? `HTTP ${r.status}` });
          return;
        }
        const d = (await r.json()) as { ok?: boolean; tracks?: CaptionTrack[]; reason?: string };
        if (!d.ok || !Array.isArray(d.tracks)) {
          setState({ status: 'error', reason: d.reason ?? 'unavailable' });
          return;
        }
        setState({ status: 'ok', tracks: d.tracks });
      })
      .catch((e) => { if (!cancelled) setState({ status: 'error', reason: (e as Error).message }); });
    return () => { cancelled = true; };
  }, [videoId, langsKey, langs.length]);

  if (langs.length === 0) return null; // no SubtitleTrack section → no panel

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--muted)] px-4 py-3">
        <h3 className="text-sm font-semibold">Transcript</h3>
        <span className="text-xs text-[color:var(--muted-fg)]">{langs.map(langLabel).join('  ·  ')}</span>
      </div>
      {state.status === 'loading' && (
        <p className="px-4 py-6 text-sm text-[color:var(--muted-fg)]">
          Loading captions… <span className="opacity-60">(translating can take a few seconds the first time)</span>
        </p>
      )}
      {state.status === 'error' && (
        <p className="px-4 py-6 text-sm text-[color:var(--muted-fg)]">
          Captions unavailable for this video. <span className="opacity-60">({state.reason})</span>
        </p>
      )}
      {state.status === 'ok' && <TranscriptRows tracks={state.tracks} />}
    </section>
  );
}

// Text of the cue active at time `t` (last cue whose start <= t). Binary
// search since cues are sorted by start. Used to align columns by TIME — a
// translated track shares the anchor's timestamps (exact match), while a
// NATIVE second track has YouTube's own segmentation and must be matched by
// time, not row index.
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

function TranscriptRows({ tracks }: { tracks: CaptionTrack[] }) {
  const anchor = tracks[0];
  if (!anchor || anchor.cues.length === 0) {
    return <p className="px-4 py-6 text-sm text-[color:var(--muted-fg)]">No caption lines.</p>;
  }
  // timestamp column + one column per language. Inline because Tailwind's JIT
  // can't see a runtime-constructed grid-cols-[…] class. Rows are driven by the
  // anchor's cues; other columns show the line active at each anchor time.
  const gridTemplateColumns = `3.5rem repeat(${tracks.length}, minmax(0, 1fr))`;
  return (
    <div className="max-h-[28rem] overflow-y-auto">
      {anchor.cues.map((cue, i) => (
        <div
          key={i}
          className="grid items-start gap-3 border-b border-[color:var(--border)] px-4 py-2 text-sm last:border-b-0 hover:bg-[color:var(--muted)]"
          style={{ gridTemplateColumns }}
        >
          <span className="pt-0.5 text-xs text-[color:var(--muted-fg)]">{fmt(cue.start)}</span>
          {tracks.map((t, ti) => (
            <span key={ti} className={ti === 0 ? 'font-medium leading-snug' : 'leading-snug text-[color:var(--muted-fg)]'}>
              {ti === 0 ? cue.text : cueTextAt(t, cue.start)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
