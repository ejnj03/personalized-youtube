import { z } from 'zod';
// Server-safe '/core' entry (this schema is parsed in RSC/server contexts).
import { sourceRulesField, SourceScheduleSchema } from '@showcase/sdk/core';
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
  // Optional per-section overrides of the theme-level card / layout presets.
  // When set, this section renders with the named preset instead of inheriting
  // the theme default — lets a single grid use a different archetype.
  cardPreset: z
    .string()
    .optional()
    .describe(
      'Override theme.cardPreset for THIS section only. Pick a card archetype ' +
        'name (e.g. "square_card", "audio_card", "horizontal_row").',
    ),
  layoutPreset: z
    .string()
    .optional()
    .describe(
      'Override theme.layoutPreset for THIS section only. Pick a layout name ' +
        '(e.g. "grid_oneCol", "grid_compact", "row_scroll").',
    ),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(4),
  density: z.enum(['compact', 'cozy', 'comfortable']).default('cozy'),
  // 'grid'    — standard column grid (default).
  // 'shelves' — bookshop layout: section-titled shelves of 2-col cards.
  // 'list'    — single column, horizontal cards, dense info.
  layout: z.enum(['grid', 'shelves', 'list']).default('grid'),
  videos: z.array(Video).default([]),
  // Curated content RULES (SDK SourceRules). Each rule = curated `queries` +
  // named `creators` (channels/youtubers) + optional title `tags` + optional
  // time window. Non-empty → the grid fetches these searches (every query AND
  // creator, deduped, topN each), narrows by tags, and re-evaluates windows
  // every minute — no LLM call to apply. The agent curates + writes them.
  sources: sourceRulesField(
    'Curated content rules for this row. Each rule = curated `queries` (concrete search phrases) + `creators` (specific YouTube channels/youtubers) + optional title `tags` + optional time window. Non-empty → the row is filled by these searches instead of the static videos. Use this (NOT request_more_content) for PERSISTENT/scheduled requests like "only academic videos from 9–11pm" — and CURATE several concrete queries + real channels, not one vague term.',
  ),
  // Section-level fallback window for rules that don't set their own schedule.
  schedule: SourceScheduleSchema.optional().describe(
    'Default time window applied to any `sources` rule that has no schedule of its own.',
  ),
});

// A NAMED, curated row. Add several (via add_section) to build "first row X,
// rows beneath Y". Each has an editable title + the full SourceRules + a list
// of pinned videos that stick to the front.
export const RecommendedRow = baseSection('RecommendedRow', {
  // Optional per-section override of theme.cardPreset for this row.
  cardPreset: z
    .string()
    .optional()
    .describe(
      'Override theme.cardPreset for THIS row only. Pick a card archetype ' +
        '(e.g. "audio_card", "compact_card").',
    ),
  headline: z
    .string()
    .default('Recommended for you')
    .describe('The row title shown above it (the visitor can also click it to rename). NAME it for its content, e.g. "Korean grammar lessons".'),
  videos: z.array(Video).default([]),
  // Pinned videos — always shown FIRST and persist regardless of sources /
  // schedule, until removed. The agent adds a full video object here when the
  // visitor asks to pin/insert a specific video into this row.
  pinned: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().default(''),
        channel: z.string().default(''),
      }),
    )
    .default([])
    .describe('Videos pinned to the FRONT of this row; they persist until removed. When the visitor @-mentions/references a video and asks to pin/insert it here, push { id, title, channel } (from the referenced video) into this array. Remove an entry to unpin.'),
  // Curated rules (SDK SourceRules) — same contract as VideoGrid.sources.
  sources: sourceRulesField(
    'Curated content rules for this NAMED row — curated `queries` + `creators` (channels/youtubers) + optional title `tags` + optional time window. Non-empty → the row fills from these searches. Pair with a descriptive `headline` (e.g. headline "Korean variety shows" + queries ["korean variety show","런닝맨"]).',
  ),
  schedule: SourceScheduleSchema.optional().describe('Default time window for sources without their own schedule.'),
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
