'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Patch } from '@showcase/sdk';
// YT-shared PageConfig is strict (typed sort/filter); SDK's is loose
// (Record<string, unknown>). YT consumers (PageRoot, Sidebar, templates)
// were written against the strict shape, so we use it for the public surface.
import type { PageConfig } from '@showcase/shared';

import { PersonalizationRoot, usePersonalization, type Section } from '@showcase/sdk';
import { SectionSchema } from '@showcase/shared';
import { host } from './personalization';

// Materialize Zod defaults on a freshly added section so agent-added sections
// (e.g. a RecommendedRow with only `headline`+`sources`) get `videos: []`,
// `pinned: []`, etc. — otherwise consumers crash on undefined props. Falls back
// to the raw draft if the type is unknown / parse fails.
function parseYtSection(draft: Section): Section {
  try {
    return SectionSchema.parse(draft) as unknown as Section;
  } catch {
    return draft;
  }
}


export interface YtChipEntry {
  text: string;
  params: string | null;
}

export type NavKey = 'Home' | 'Shorts' | 'Subscriptions' | 'You' | 'Library' | 'History';

// Pre-search snapshot of the home page. We capture the whole config (not just
// the videos) because search mutates several sections at once — grid videos,
// row visibility, filter state — and restoring piecemeal would have to know
// every section the search touches.
export interface HomeSnapshot {
  config: PageConfig;
  ytContinuation: string | null;
}

interface PageStoreValue {
  config: PageConfig;
  pageSlug: string;
  dispatch: (patch: Patch, options?: { persist?: boolean; rationale?: string; trace?: boolean }) => void;
  replace: (config: PageConfig) => void;
  // YouTube-source extras: continuation token for infinite scroll, mutable
  // so the grid can update it after each /api/yt/more page lands.
  ytContinuation: string | null;
  setYtContinuation: (token: string | null) => void;
  // Real chip metadata extracted from the home browse response. Map text → params token.
  ytChips: YtChipEntry[];
  // Currently-watched video for the in-app embed overlay; null when closed.
  watchingId: string | null;
  watchingTitle: string | null;
  setWatching: (id: string | null, title?: string | null) => void;
  // Sidebar navigation: which top-level nav item is active and (when in
  // Subscriptions mode) which channel is selected. Local-only state, doesn't
  // round-trip through the patch system since it doesn't change PageConfig.
  activeNav: NavKey;
  selectedChannel: string | null;
  setActiveNav: (key: NavKey, channel?: string | null) => void;
  // Search mode: when non-null, the page is showing search results.
  // enterSearch captures a one-shot snapshot of the home state on first
  // entry; exitSearch restores that snapshot (logo click / back button).
  searchQuery: string | null;
  enterSearch: (query: string, snapshot: HomeSnapshot) => void;
  exitSearch: () => void;
}

// ─── YT-specific state provider ──────────────────────────────────────────
// Holds everything that's NOT generic personalization state (watching ctx,
// nav, search, infinite-scroll continuation, YT-only mode flag).
// Sits inside <PersonalizationRoot> so consumers via usePageStore() can
// read both worlds together.

interface YtStateValue {
  pageSlug: string;
  ytContinuation: string | null;
  setYtContinuation: (token: string | null) => void;
  ytChips: YtChipEntry[];
  watchingId: string | null;
  watchingTitle: string | null;
  setWatching: (id: string | null, title?: string | null) => void;
  activeNav: NavKey;
  selectedChannel: string | null;
  setActiveNav: (key: NavKey, channel?: string | null) => void;
  searchQuery: string | null;
  enterSearch: (query: string, snapshot: HomeSnapshot) => void;
  exitSearch: () => void;
}

const YtStateContext = createContext<YtStateValue | null>(null);

function YtStateProvider({
  initialYtContinuation = null,
  initialYtChips = [],
  initialWatchingId = null,
  pageSlug,
  children,
}: {
  initialYtContinuation?: string | null;
  initialYtChips?: YtChipEntry[];
  initialWatchingId?: string | null;
  pageSlug: string;
  children: ReactNode;
}) {
  const { replace } = usePersonalization(); // borrow SDK's replace for exitSearch

  const [ytContinuation, setYtContinuation] = useState<string | null>(initialYtContinuation);
  const [watchingId, setWatchingId] = useState<string | null>(initialWatchingId);
  const [watchingTitle, setWatchingTitle] = useState<string | null>(null);
  const [activeNav, setActiveNavState] = useState<NavKey>('Home');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [homeSnapshot, setHomeSnapshot] = useState<HomeSnapshot | null>(null);

  const enterSearch = useCallback((query: string, snapshot: HomeSnapshot) => {
    setSearchQuery(query);
    setHomeSnapshot((prev) => prev ?? snapshot);
  }, []);

  const exitSearch = useCallback(() => {
    setHomeSnapshot((snap) => {
      if (snap) {
        replace(snap.config);                  // ← SDK provider holds config now
        setYtContinuation(snap.ytContinuation);
      }
      return null;
    });
    setSearchQuery(null);
  }, [replace]);

  const setActiveNav = useCallback((key: NavKey, channel?: string | null) => {
    setActiveNavState(key);
    setSelectedChannel(typeof channel === 'string' ? channel : null);
  }, []);

  const setWatching = useCallback((id: string | null, title?: string | null) => {
    setWatchingId(id);
    setWatchingTitle(typeof title === 'string' ? title : null);
  }, []);

  return (
    <YtStateContext.Provider
      value={{
        pageSlug,
        ytContinuation,
        setYtContinuation,
        ytChips: initialYtChips,
        watchingId,
        watchingTitle,
        setWatching,
        activeNav,
        selectedChannel,
        setActiveNav,
        searchQuery,
        enterSearch,
        exitSearch,
      }}
    >
      {children}
    </YtStateContext.Provider>
  );
}

// ─── Outer provider — composes SDK + YT state ────────────────────────────
// The old PageStoreProvider held config locally and threaded YT state through
// the same context. Now it's a thin composition: PersonalizationRoot owns
// config + dispatch + replace; YtStateProvider owns YT-specific UI state.
// usePageStore() (below) merges both for backwards-compatible consumers.

export function PageStoreProvider({
  initialConfig,
  initialYtContinuation = null,
  initialYtChips = [],
  initialWatchingId = null,
  pageSlug,
  children,
}: {
  initialConfig: PageConfig;
  initialYtContinuation?: string | null;
  initialYtChips?: YtChipEntry[];
  initialWatchingId?: string | null;
  pageSlug: string;
  children: ReactNode;
}) {
  return (
    <PersonalizationRoot host={host} initialConfig={initialConfig} parseSection={parseYtSection}>
      <YtStateProvider
        pageSlug={pageSlug}
        initialYtContinuation={initialYtContinuation}
        initialYtChips={initialYtChips}
        initialWatchingId={initialWatchingId}
      >
        {children}
      </YtStateProvider>
    </PersonalizationRoot>
  );
}

// ─── Hook for YT-specific state ──────────────────────────────────────────
function useYtState(): YtStateValue {
  const value = useContext(YtStateContext);
  if (!value) {
    throw new Error('useYtState must be used within <PageStoreProvider>');
  }
  return value;
}

// ─── Public hook — merges SDK config/dispatch with YT-specific state ─────
// Backwards-compatible: every consumer that did `usePageStore()` keeps
// working. Now config/dispatch/replace come from <PersonalizationRoot>
// instead of being held locally.
export function usePageStore(): PageStoreValue {
  const sdk = usePersonalization();   // { config, dispatch, replace }
  const yt = useYtState();            // { ytContinuation, watchingId, ... }

  return {
    // SDK's PageConfig has Record<string, unknown> for sort/filter; YT
    // consumers expect the typed shape from @showcase/shared. Structurally
    // compatible — patches always produce the strict shape — so we assert.
    config: sdk.config as unknown as PageConfig,
    replace: sdk.replace,
    // SDK dispatch is (patch) => void; YT consumers may pass an options arg
    // (persist/rationale/trace). For v0 we discard those — Stage 9 will
    // re-introduce persistence via the SDK's PersistenceAdapter interface.
    dispatch: (patch, _options) => sdk.dispatch(patch),
    ...yt,
  };
}
