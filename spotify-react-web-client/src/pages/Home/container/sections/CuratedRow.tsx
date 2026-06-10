import { Col } from 'antd';
import { memo } from 'react';
import { useConfig, useSourceRules, type SourceRule, type SourceSchedule } from '@showcase/sdk';

import { querySearch } from '../../../../services/search';
import { playerService } from '../../../../services/player';
import type { Track } from '../../../../interfaces/track';

// provideContent for the SDK rule engine: one curated term (a query OR a
// named artist/album) → Spotify track search. Client-side, under the logged-in
// user's token (no server endpoint needed). The hook fans out over every term
// of every active rule and merges; topN is applied by the hook.
const provideTracks = (term: string): Promise<Track[]> =>
  querySearch({ q: term, type: 'track' })
    .then((r) => r.data.tracks?.items ?? [])
    .catch(() => []);

function TrackCard({ track }: { track: Track }) {
  const cover = track.album?.images?.[0]?.url;
  const artists = track.artists.map((a) => a.name).join(', ');
  return (
    <button
      type="button"
      onClick={() => void playerService.startPlayback({ uris: [track.uri] })}
      title={`${track.name} — ${artists}`}
      style={{
        width: 160,
        flexShrink: 0,
        textAlign: 'left',
        background: 'var(--surface, #1f1f1f)',
        border: 'none',
        borderRadius: 8,
        padding: 12,
        cursor: 'pointer',
        color: 'var(--fg, #fff)',
      }}
    >
      <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 6, overflow: 'hidden', background: 'var(--muted, #282828)' }}>
        {cover && (
          <img src={cover} alt={track.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {track.name}
      </div>
      <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted-fg, #b3b3b3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {artists}
      </div>
    </button>
  );
}

function CuratedRowInner({
  title,
  sources,
  schedule,
}: {
  title: string;
  sources: SourceRule[];
  schedule?: SourceSchedule;
}) {
  const { items, loading, active } = useSourceRules<Track>({
    rules: sources,
    fallbackSchedule: schedule,
    provideContent: provideTracks,
    itemKey: (t) => t.id,
    itemTitle: (t) => t.name,
  });

  // Nothing to show when no rule is active (outside its window, or no rules yet).
  if (!active) return null;
  const tracks = items ?? [];

  return (
    <Col span={24}>
      <section style={{ padding: '8px 0 16px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg, #fff)', margin: '0 0 12px' }}>{title}</h2>
        {loading && tracks.length === 0 ? (
          <p style={{ color: 'var(--muted-fg, #b3b3b3)', fontSize: 14 }}>Loading…</p>
        ) : tracks.length === 0 ? (
          <p style={{ color: 'var(--muted-fg, #b3b3b3)', fontSize: 14 }}>No matches right now.</p>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {tracks.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </div>
        )}
      </section>
    </Col>
  );
}

// Reads any CuratedRow sections from the personalization config and renders
// them natively on the home (Spotify content stays native; only this row is
// SDK-config-driven). The LLM edits each row's props.sources.
export const CuratedRow = memo(() => {
  const config = useConfig();
  const sections = (config.sections ?? []) as Array<{ id: string; type: string; props: unknown }>;
  const rows = sections.filter((s) => s.type === 'CuratedRow');
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((s) => {
        const props = s.props as { title?: string; sources?: SourceRule[]; schedule?: SourceSchedule };
        return (
          <CuratedRowInner
            key={s.id}
            title={props.title ?? 'On a schedule'}
            sources={props.sources ?? []}
            schedule={props.schedule}
          />
        );
      })}
    </>
  );
});
