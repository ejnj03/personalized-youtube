import dynamic from 'next/dynamic';
import type { PageConfig, Section } from '@showcase/shared';
import { host } from '@/lib/personalization';

// Always-rendered templates — eager imports.
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { CategoryChips } from './CategoryChips';
import { VideoGrid } from './VideoGrid';
import { FilterSummary } from './FilterSummary';
import { RecommendedRow } from './RecommendedRow';
import { ShortsRow } from './ShortsRow';
import { ContinueWatchingRow } from './ContinueWatchingRow';
import { CustomNote } from './CustomNote';

// Conditional templates — lazy-loaded so they don't bloat the home bundle.
// These only enter the DOM when chat adds them via add_section, so we
// shouldn't pay their JS cost up front. `loading: () => null` keeps the
// transition silent (the section just appears when ready, no skeleton flash).
const MoodBoard = dynamic(() => import('./MoodBoard').then((m) => m.MoodBoard), { loading: () => null });
const SubtitleTrack = dynamic(() => import('./SubtitleTrack').then((m) => m.SubtitleTrack), { loading: () => null });
const WatchHistoryToggle = dynamic(() => import('./WatchHistoryToggle').then((m) => m.WatchHistoryToggle), { loading: () => null });
const TimeSavedTally = dynamic(() => import('./TimeSavedTally').then((m) => m.TimeSavedTally), { loading: () => null });
// AmbientBackground is also rendered eagerly from PageRoot (at the document
// level, not via this registry). It's listed here so add_section flows still
// work — the eager PageRoot import is what controls when it loads.
const AmbientBackground = dynamic(() => import('./AmbientBackground').then((m) => m.AmbientBackground), { loading: () => null });

export interface TemplateEntry {
  // ComponentType so both eager function components and next/dynamic-wrapped
  // lazies satisfy the type. Eager components are easier to reason about; we
  // only lazy-load templates that are conditional / expensive.
  Component: React.ComponentType<{ section: Section; config: PageConfig }>;
  claudeToolHint: string;
}

export const REGISTRY = {
  TopBar: {
    Component: TopBar,
    claudeToolHint:
      'Top navigation bar with logo, search, profile chip. Use to change search-bar size, logo text, or profile visibility.',
  },
  Sidebar: {
    Component: Sidebar,
    claudeToolHint:
      'Left navigation sidebar with category links. Use to collapse/expand or change pinned items.',
  },
  CategoryChips: {
    Component: CategoryChips,
    claudeToolHint:
      'Horizontal scrolling chips above the feed for filtering by topic (All, Music, Gaming, etc.). Use to change which chip is active or which chips appear.',
  },
  VideoGrid: {
    Component: VideoGrid,
    claudeToolHint:
      'The main video card grid. Use to change column count (2-5), density (compact|cozy|comfortable), or to inject video filtering by editing this section.',
  },
  FilterSummary: {
    Component: FilterSummary,
    claudeToolHint:
      'Pills row showing what filters/sort are currently active. Auto-derives content from the page-level filter and sort state. You normally do not edit this directly — it updates when set_filter / set_sort fires.',
  },
  RecommendedRow: {
    Component: RecommendedRow,
    claudeToolHint:
      'Horizontal carousel of recommended videos. Edit headline ("Recommended for you", "Picked for jazz fans", etc.) or remove the section entirely.',
  },
  ShortsRow: {
    Component: ShortsRow,
    claudeToolHint:
      'Vertical-aspect short-form video shelf. Set visible=false (or remove_section) to hide entirely; or change headline.',
  },
  ContinueWatchingRow: {
    Component: ContinueWatchingRow,
    claudeToolHint:
      'Resume-where-you-left-off shelf. Hide via visible=false when the visitor wants a fresh-start feel.',
  },
  CustomNote: {
    Component: CustomNote,
    claudeToolHint:
      'A pinned text note on the page. Use when the visitor asks to remember something ("Note to self: rewatch this Sunday"). Set text and visible=true.',
  },
  MoodBoard: {
    Component: MoodBoard,
    claudeToolHint:
      'Replaces VideoGrid with mood-grouped sections. Use when visitor wants feed grouped by vibe ("group by focus / wind down / sharpen", "decompress mode", "I want only deep-dives"). Pass `moods: [{id,label,emoji,description,tags}]` — ANY mood ids work; tags drive classification. Add via add_section + remove_section videogrid.',
  },
  SubtitleTrack: {
    Component: SubtitleTrack,
    claudeToolHint:
      'PERSISTENT per-mode caption/translation preference — applies to EVERY video watched in this mode and survives reloads (NOT a one-off per video). Set it when the visitor wants ongoing subtitles/translation, e.g. "I want videos in this mode always translated from english to korean", "show dual subtitles in X and Y", "captions in japanese + english". ADD a SubtitleTrack (or update_section the existing one) with primary = source/first language code and secondary = translation/second language code (en/ko/ja/es/fr/de/zh/…). Real captions come from each video\'s YouTube transcript — native track when YouTube has that language, otherwise machine-translated — shown dual-column in the watch-page transcript panel. To turn it off: set visible=false or remove_section. There is at most ONE per mode.',
  },
  AmbientBackground: {
    Component: AmbientBackground,
    claudeToolHint:
      'Full-bleed ambient background tied to a content source. source=playingVideo samples colors from the watching video, source=topVideo from the first VideoGrid card. Tune intensity (0..1), grain (0..1), particles (none|mood|snow|embers). Use for "make the page breathe with what I watch", "snowfall on the homepage", "filmic grain".',
  },
  WatchHistoryToggle: {
    Component: WatchHistoryToggle,
    claudeToolHint:
      'Sidebar widget that flips filter.hideWatched / showWatchedOverlay. Use when visitor wants persistent UI control over watched-state filtering.',
  },
  TimeSavedTally: {
    Component: TimeSavedTally,
    claudeToolHint:
      'Sidebar widget showing cumulative minutes saved by chapter auto-skip. Pair with set_filter chapterFilters + autoSkip.',
  },
} satisfies Record<string, TemplateEntry>;

export function renderSection(section: Section, config: PageConfig): React.ReactNode {
  const entry = host.sections[section.type];
  if (!entry) return null;
  const Component = entry.component;
  return <Component section={section} config={config} />;
}
