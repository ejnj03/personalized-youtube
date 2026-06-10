'use client';

import type { PageConfig, Section, Video } from '@showcase/shared';
import { usePageStore } from '@/lib/store';

// Section types we hide when entering category / search mode (so the grid
// of fresh results is the only thing on screen, like real YouTube).
const ROW_SECTIONS_TO_HIDE: ReadonlyArray<string> = ['ContinueWatchingRow', 'RecommendedRow', 'ShortsRow'];

export function CategoryChips({ section, config }: { section: Section; config: PageConfig }) {
  const { dispatch, setYtContinuation, ytChips } = usePageStore();
  if (section.type !== 'CategoryChips') return null;
  const { active, chips } = section.props;
  const chipParamsByText = new Map(ytChips.map((c) => [c.text, c.params] as const));

  function setRowsVisible(visible: boolean): void {
    for (const s of config.sections) {
      if (ROW_SECTIONS_TO_HIDE.includes(s.type)) {
        dispatch({ op: 'update_section', sectionId: s.id, patch: { visible } });
      }
    }
  }

  const onClick = (chip: string) => {
    // Update which chip looks active
    dispatch(
      { op: 'update_section', sectionId: section.id, patch: { active: chip } },
      { persist: true, rationale: `chip ${chip} clicked` },
    );

    // Hit /api/yt/browse with the chip's real `params` token (extracted from
    // the live home response). All chips share the same browseId=FEwhat_to_watch
    // — only `params` differs per chip. "All" sends no params (resets to the
    // unfiltered home feed).
    const params = chipParamsByText.get(chip) ?? null;
    const qs = new URLSearchParams({ id: 'FEwhat_to_watch' });
    if (chip !== 'All' && typeof params === 'string' && params.length > 0) {
      qs.set('params', params);
    }
    void fetch(`/api/yt/browse?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; videos?: Video[]; continuation?: string | null } | null) => {
        if (!data?.ok || !Array.isArray(data.videos) || data.videos.length === 0) return;
        const grid = config.sections.find((s) => s.type === 'VideoGrid');
        if (grid) {
          dispatch({ op: 'update_section', sectionId: grid.id, patch: { videos: data.videos } });
        } else {
          // Resilience: if the visitor was in MoodBoard mode and there's
          // no VideoGrid, restore one so chip results have somewhere to land.
          const replacements = config.sections.filter((s) => s.type === 'MoodBoard');
          for (const r of replacements) {
            dispatch({ op: 'remove_section', sectionId: r.id });
          }
          dispatch({
            op: 'add_section',
            sectionType: 'VideoGrid',
            props: { videos: data.videos, columns: 4, density: 'cozy' },
            position: { after: 'categoryChips' },
          });
        }
        setYtContinuation(
          typeof data.continuation === 'string' && data.continuation.length > 0 ? data.continuation : null,
        );
        dispatch({ op: 'set_filter', filter: { requireTags: [] } });
        setRowsVisible(chip === 'All');
      })
      .catch(() => {
        // best-effort; user can retry
      });
  };

  return (
    <div
      className="sticky top-14 z-20 flex gap-3 overflow-x-auto border-b border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ backdropFilter: `blur(var(--surface-blur))`, WebkitBackdropFilter: `blur(var(--surface-blur))` }}
    >
      {chips.map((chip) => {
        const isActive = chip === active;
        return (
          <button
            key={chip}
            onClick={() => onClick(chip)}
            className={`shrink-0 rounded-md px-3 py-1 text-sm transition-colors ${
              isActive
                ? 'bg-[color:var(--fg)] text-[color:var(--bg)]'
                : 'bg-[color:var(--muted)] text-[color:var(--fg)] hover:bg-[color:var(--border)]'
            }`}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
