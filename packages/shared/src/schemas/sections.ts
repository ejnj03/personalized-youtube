import { z } from 'zod';
import { Video, Short, Chapter } from './video';

const baseSection = <T extends string, P extends z.ZodRawShape>(type: T, props: P) =>
  z.object({
    id: z.string(),
    type: z.literal(type),
    props: z.object(props),
  });

export const TopBar = baseSection('TopBar', {
  logoText: z.string().default('YouTube'),
  searchPlaceholder: z.string().default('Search'),
  compactSearch: z.boolean().default(false),
  showProfileChip: z.boolean().default(true),
});

export const Sidebar = baseSection('Sidebar', {
  collapsed: z.boolean().default(false),
  pinnedItems: z.array(z.string()).default(['Home', 'Shorts', 'Subscriptions', 'You']),
  showSubscriptions: z.boolean().default(true),
});

export const CategoryChips = baseSection('CategoryChips', {
  active: z.string().default('All'),
  chips: z.array(z.string()).default([
    'All', 'Music', 'Gaming', 'Live', 'News', 'Cooking', 'Comedy', 'Recently uploaded',
  ]),
});

export const VideoGrid = baseSection('VideoGrid', {
  columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(4),
  density: z.enum(['compact', 'cozy', 'comfortable']).default('cozy'),
  // 'grid'    — standard column grid (default).
  // 'shelves' — bookshop layout: section-titled shelves of 2-col cards.
  // 'list'    — single column, horizontal cards, dense info.
  layout: z.enum(['grid', 'shelves', 'list']).default('grid'),
  videos: z.array(Video).default([]),
  // Curated-feed sources. When non-empty AND the schedule window (if set) is
  // active, the grid loads videos by running each search query in parallel,
  // taking the top `topN` from each, and merging them (deduped by video id).
  // Existing client-side filters (requireLanguage, minSubscriberCount, etc.)
  // run on the union, so low-quality stragglers still get dropped.
  sources: z
    .array(
      z.object({
        query: z.string(),
        topN: z.number().int().positive().default(8),
      }),
    )
    .default([]),
  // Time-of-day gating. When set, `sources` only apply when the visitor's
  // local hour is within [start, end) — end exclusive, both 0–23. Outside
  // the window, the grid falls back to the static `videos` array.
  // Wraps midnight when start > end (e.g. [22, 6] = 10pm–6am).
  schedule: z
    .object({
      activeHoursLocal: z.tuple([
        z.number().int().min(0).max(23),
        z.number().int().min(0).max(23),
      ]),
    })
    .optional(),
});

export const RecommendedRow = baseSection('RecommendedRow', {
  headline: z.string().default('Recommended for you'),
  videos: z.array(Video).default([]),
});

export const ShortsRow = baseSection('ShortsRow', {
  visible: z.boolean().default(true),
  headline: z.string().default('Shorts'),
  shorts: z.array(Short).default([]),
});

export const ContinueWatchingRow = baseSection('ContinueWatchingRow', {
  visible: z.boolean().default(true),
  headline: z.string().default('Continue watching'),
  videos: z.array(Video).default([]),
});

export const FilterSummary = baseSection('FilterSummary', {
  visible: z.boolean().default(false),
  active: z.array(z.object({
    label: z.string(),
    kind: z.enum(['include', 'exclude', 'requireTag', 'blockChannel', 'sort']),
  })).default([]),
});

export const CustomNote = baseSection('CustomNote', {
  text: z.string().default(''),
  visible: z.boolean().default(false),
});

// ── New, generalizable section primitives ─────────────────────────────────
// Each one is the *minimum-surface-area* version of a pattern that emerged
// from the design scenarios. The LLM can swap these in via add_section /
// remove_section and tune them via update_section, so any prompt that fits
// the pattern (not just the 6 scripted ones) works.

// MoodBoard replaces VideoGrid when the visitor wants their feed grouped by
// vibe instead of recency. `moods` is open-ended — visitor can ask for
// custom buckets ("focus / decompress / nostalgia") and the LLM emits them.
export const Mood = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string().default(''),
  description: z.string().default(''),
  // Tag matchers used by the classifier. A video lands in this mood if any
  // of its tags appear here, OR if Video.mood === this.id.
  tags: z.array(z.string()).default([]),
});
export type Mood = z.infer<typeof Mood>;

export const MoodBoard = baseSection('MoodBoard', {
  moods: z.array(Mood).default([
    { id: 'focus', label: 'Focus', emoji: '◐', description: 'Long-form, single-topic, low-energy.', tags: ['lofi', 'focus', 'documentary', 'engineering', 'deep'] },
    { id: 'winddown', label: 'Wind down', emoji: '◌', description: 'Calm pacing, friendly voices.', tags: ['slow', 'calm', 'asmr', 'sleep', 'vlog'] },
    { id: 'sharpen', label: 'Sharpen', emoji: '◉', description: 'Argued, longer than 30 min.', tags: ['philosophy', 'debate', 'analysis', 'longform'] },
    { id: 'curious', label: 'Curious', emoji: '✦', description: 'Random rabbit holes.', tags: ['mahjong', 'craft', 'culture', 'games'] },
  ]),
  // 'cozy' / 'compact' / 'comfortable' per-mood density override. Empty = use VideoGrid default.
  densityPerMood: z.record(z.string(), z.enum(['compact', 'cozy', 'comfortable'])).default({}),
  // Optional curated video pool. If empty, the renderer pulls from the
  // adjacent VideoGrid's videos (so it works as a drop-in replacement).
  videos: z.array(Video).default([]),
});

// SubtitleTrack overlays on the watch page. Renders the primary language
// big + secondary language soft underneath. hoverDefine + vocabPin are
// intent flags consumed by the watch player.
export const SubtitleTrack = baseSection('SubtitleTrack', {
  visible: z.boolean().default(true),
  primary: z.string().default('en'),
  secondary: z.string().optional(),
  hoverDefine: z.boolean().default(false),
  vocabPin: z.boolean().default(false),
  position: z.enum(['overlay', 'docked']).default('overlay'),
});

// AmbientBackground is a full-bleed background tied to a content source
// (the currently-playing video). The renderer samples colors from the
// thumbnail and animates a soft radial blob behind everything.
export const AmbientBackground = baseSection('AmbientBackground', {
  visible: z.boolean().default(true),
  source: z.enum(['playingVideo', 'topVideo']).default('playingVideo'),
  intensity: z.number().min(0).max(1).default(0.7),
  grain: z.number().min(0).max(1).default(0.18),
  // Particle drift cues atmosphere. Each kind has its own physics:
  //   none    — no overlay
  //   mood    — soft hue dots drifting upward (default vibe)
  //   snow    — white flakes settling slowly down
  //   embers  — orange sparks rising fast with flicker
  //   clouds  — wispy white shapes drifting horizontally
  //   leaves  — spiral-falling autumn leaves
  //   rain    — fast diagonal streaks
  //   stars   — twinkling points in place
  particles: z.enum(['none', 'mood', 'snow', 'embers', 'clouds', 'leaves', 'rain', 'stars']).default('none'),
});

// WatchHistoryToggle is a small sidebar widget that lets visitors flip
// hideWatched on/off without round-tripping through chat. Lives anywhere
// (typically Sidebar-area).
export const WatchHistoryToggle = baseSection('WatchHistoryToggle', {
  visible: z.boolean().default(true),
  defaultHidden: z.boolean().default(true),
  position: z.enum(['sidebar', 'topbar', 'inline']).default('sidebar'),
});

// TimeSavedTally tallies up minutes saved by chapter-skip. Pure UI; the
// actual skip logic lives in the watch player listener.
export const TimeSavedTally = baseSection('TimeSavedTally', {
  visible: z.boolean().default(true),
  position: z.enum(['sidebar', 'topbar', 'inline']).default('sidebar'),
  // Cumulative minutes — read by the renderer from local storage / store.
  minutesSavedThisWeek: z.number().nonnegative().default(0),
});

export const SectionSchema = z.discriminatedUnion('type', [
  TopBar,
  Sidebar,
  CategoryChips,
  VideoGrid,
  RecommendedRow,
  ShortsRow,
  ContinueWatchingRow,
  FilterSummary,
  CustomNote,
  MoodBoard,
  SubtitleTrack,
  AmbientBackground,
  WatchHistoryToggle,
  TimeSavedTally,
]);
export type Section = z.infer<typeof SectionSchema>;

export const SECTION_TYPES = [
  'TopBar', 'Sidebar', 'CategoryChips', 'VideoGrid', 'RecommendedRow',
  'ShortsRow', 'ContinueWatchingRow', 'FilterSummary', 'CustomNote',
  'MoodBoard', 'SubtitleTrack', 'AmbientBackground', 'WatchHistoryToggle', 'TimeSavedTally',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

// Re-export Chapter so consumers can import it from one place.
export { Chapter } from './video';
