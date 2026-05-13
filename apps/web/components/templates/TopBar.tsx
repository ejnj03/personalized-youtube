'use client';

import { useEffect, useState } from 'react';
import type { PageConfig, Section, Video } from '@showcase/shared';
import { usePageStore } from '@/lib/store';

const ROW_SECTIONS_TO_HIDE_FOR_SEARCH: ReadonlyArray<string> = ['ContinueWatchingRow', 'RecommendedRow', 'ShortsRow'];

export function TopBar({ section, config }: { section: Section; config: PageConfig }) {
  const {
    dispatch,
    setYtContinuation,
    youtubeMode,
    setActiveNav,
    setWatching,
    enterSearch,
    exitSearch,
    searchQuery,
    ytContinuation,
  } = usePageStore();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Clear the input when search exits (via logo click or browser back) so a
  // subsequent "/" focus drops you into an empty box, not last search's text.
  useEffect(() => {
    if (searchQuery === null) setQuery('');
    else setQuery(searchQuery);
  }, [searchQuery]);

  if (section.type !== 'TopBar') return null;
  const { logoText, searchPlaceholder, compactSearch, showProfileChip } = section.props;

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length === 0 || searching) return;
    if (!youtubeMode) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/yt/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; videos?: Video[] };
      if (!data.ok || !Array.isArray(data.videos) || data.videos.length === 0) return;
      // Snapshot the home state BEFORE mutating, so the logo / back button
      // can restore it. enterSearch only snapshots on first entry — repeat
      // searches reuse the original snapshot so they still return home.
      enterSearch(q, { config, ytContinuation });
      // Find a VideoGrid to put results in. If the visitor previously asked
      // for MoodBoard / unusual layout and the grid was removed, restore it
      // so search always lands somewhere visible.
      const grid = config.sections.find((s) => s.type === 'VideoGrid');
      if (grid) {
        dispatch({ op: 'update_section', sectionId: grid.id, patch: { videos: data.videos } });
      } else {
        // Drop the MoodBoard (or whatever replaced VideoGrid) and add VideoGrid back.
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
      // Search results aren't paginated in this scope; clear the continuation
      // so infinite scroll doesn't append home-feed videos to search results.
      setYtContinuation(null);
      dispatch({ op: 'set_filter', filter: { requireTags: [] } });
      // Hide row sections so only the search results show — matches real YT.
      // (Restore happens automatically via the home snapshot on exit, so we
      // don't have to remember which were hidden.)
      for (const s of config.sections) {
        if (ROW_SECTIONS_TO_HIDE_FOR_SEARCH.includes(s.type)) {
          dispatch({ op: 'remove_section', sectionId: s.id });
        }
      }
    } finally {
      setSearching(false);
    }
  }

  function goHome() {
    setWatching(null);
    setActiveNav('Home', null);
    exitSearch();
  }

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4"
      style={{ backdropFilter: `blur(var(--surface-blur))`, WebkitBackdropFilter: `blur(var(--surface-blur))` }}
    >
      <button
        aria-label="Toggle navigation"
        className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--fg)] hover:bg-[color:var(--muted)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={goHome}
        aria-label={`${logoText} home`}
        className="flex items-center gap-1.5 rounded-md select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      >
        <span className="grid h-7 w-10 place-items-center rounded-md bg-[color:var(--accent)] text-[color:var(--accent-fg)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-lg font-bold tracking-tight">{logoText}</span>
      </button>

      <form
        className={`mx-auto flex items-stretch ${compactSearch ? 'w-72' : 'w-full max-w-2xl'}`}
        onSubmit={onSearch}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={youtubeMode ? searchPlaceholder : `${searchPlaceholder} (mock mode)`}
          disabled={searching}
          className="w-full rounded-l-full border border-[color:var(--border)] bg-[color:var(--bg)] px-4 py-2 text-sm outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Search"
          disabled={searching || !youtubeMode}
          title={youtubeMode ? 'Search your YouTube' : 'Search requires SHOWCASE_FEED_SOURCE=youtube'}
          className="rounded-r-full border border-l-0 border-[color:var(--border)] bg-[color:var(--muted)] px-5 hover:bg-[color:var(--border)] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M21 20.3l-5.4-5.4a7.5 7.5 0 1 0-1.4 1.4l5.4 5.4zM4 9.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z" />
          </svg>
        </button>
      </form>

      {showProfileChip && (
        <div className="flex items-center gap-2">
          <button
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[color:var(--muted)]"
            aria-label="Create"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2zm7-3.78v6.78a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.22l4-2v6.56l-4-2z" />
            </svg>
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[color:var(--muted)]"
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M10 20h4a2 2 0 0 1-4 0zm10-2v-1l-2-1.5V11a6 6 0 0 0-5-5.92V4a1 1 0 0 0-2 0v1.08A6 6 0 0 0 6 11v4.5L4 17v1z" />
            </svg>
          </button>
          <div
            className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--accent)] text-sm font-semibold text-[color:var(--accent-fg)]"
            aria-label="Profile"
          >
            E
          </div>
        </div>
      )}
    </header>
  );
}
