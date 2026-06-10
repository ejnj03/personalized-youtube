// defineHost is pure core; import from the server-safe '/core' entry so this
// module (also imported by api/chat/route.ts on the server) never pulls the
// 'use client' root barrel into a server context.
import { defineHost, type PersistenceAdapter, type PageConfig } from '@showcase/sdk/core';
import { ThemeSchema } from '@showcase/shared/schemas';

// NOTE: this file is imported by client components (ChatPanel wrapper), so it
// must stay client-safe. Server-only wiring (supabasePersistence, fileLogger)
// lives in apps/web/app/api/chat/route.ts where it spreads onto `host` before
// passing to createNextHandler. See Stage 9c.

// Section SCHEMAS (alias each with `Schema` suffix)
import {
  TopBar as TopBarSchema,
  Sidebar as SidebarSchema,
  CategoryChips as CategoryChipsSchema,
  VideoGrid as VideoGridSchema,
  RecommendedRow as RecommendedRowSchema,
  ShortsRow as ShortsRowSchema,
  ContinueWatchingRow as ContinueWatchingRowSchema,
  FilterSummary as FilterSummarySchema,
  CustomNote as CustomNoteSchema,
  MoodBoard as MoodBoardSchema,
  SubtitleTrack as SubtitleTrackSchema,
  AmbientBackground as AmbientBackgroundSchema,
  WatchHistoryToggle as WatchHistoryToggleSchema,
  TimeSavedTally as TimeSavedTallySchema,
} from '@showcase/shared/schemas';

// Section COMPONENTS — reuse the existing registry's references
import { REGISTRY } from '@/components/templates/registry';

// ─── Client-safe stub persistence ───
// route.ts wraps `host` with the real supabasePersistence before mounting.
// This stub keeps personalization.ts importable in client bundles.
const stubPersistence: PersistenceAdapter = {
  async read() {
    return [];
  },
  async write() {},
  async reset() {},
  async recordTurn() {},
  async readTurns() {
    return [];
  },
  async listModes() {
    return [];
  },
  async createMode(_visitorId, _slug, title) {
    return { id: `stub-${Date.now()}`, title, createdAt: new Date().toISOString() };
  },
};

// ─── Stub initial config (Stage 9 will load from DB) ───
// theme is parsed through ThemeSchema so defineTokens/defineFonts defaults
// (theme.tokens.*, theme.fontFamily) are populated — otherwise the SDK's
// token publisher in <PersonalizationRoot> has nothing to write to CSS vars.
const initialConfig: PageConfig = {
  id: 'streaming-platform',
  slug: 'streaming-platform',
  theme: ThemeSchema.parse({}),
  sections: [],
  filter: {},
  sort: {},
  meta: { title: 'YouTube', favicon: '/favicon.ico' },
};

export const host = defineHost({
  theme: { schema: ThemeSchema },
  sections: {
    TopBar:               { schema: TopBarSchema,               component: REGISTRY.TopBar.Component,               description: REGISTRY.TopBar.claudeToolHint },
    Sidebar:              { schema: SidebarSchema,              component: REGISTRY.Sidebar.Component,              description: REGISTRY.Sidebar.claudeToolHint },
    CategoryChips:        { schema: CategoryChipsSchema,        component: REGISTRY.CategoryChips.Component,        description: REGISTRY.CategoryChips.claudeToolHint },
    VideoGrid:            { schema: VideoGridSchema,            component: REGISTRY.VideoGrid.Component,            description: REGISTRY.VideoGrid.claudeToolHint },
    RecommendedRow:       { schema: RecommendedRowSchema,       component: REGISTRY.RecommendedRow.Component,       description: REGISTRY.RecommendedRow.claudeToolHint },
    ShortsRow:            { schema: ShortsRowSchema,            component: REGISTRY.ShortsRow.Component,            description: REGISTRY.ShortsRow.claudeToolHint },
    ContinueWatchingRow:  { schema: ContinueWatchingRowSchema,  component: REGISTRY.ContinueWatchingRow.Component,  description: REGISTRY.ContinueWatchingRow.claudeToolHint },
    FilterSummary:        { schema: FilterSummarySchema,        component: REGISTRY.FilterSummary.Component,        description: REGISTRY.FilterSummary.claudeToolHint },
    CustomNote:           { schema: CustomNoteSchema,           component: REGISTRY.CustomNote.Component,           description: REGISTRY.CustomNote.claudeToolHint },
    MoodBoard:            { schema: MoodBoardSchema,            component: REGISTRY.MoodBoard.Component,            description: REGISTRY.MoodBoard.claudeToolHint },
    SubtitleTrack:        { schema: SubtitleTrackSchema,        component: REGISTRY.SubtitleTrack!.Component,        description: REGISTRY.SubtitleTrack.claudeToolHint },
    AmbientBackground:    { schema: AmbientBackgroundSchema,    component: REGISTRY.AmbientBackground!.Component,    description: REGISTRY.AmbientBackground.claudeToolHint },
    WatchHistoryToggle:   { schema: WatchHistoryToggleSchema,   component: REGISTRY.WatchHistoryToggle!.Component,   description: REGISTRY.WatchHistoryToggle.claudeToolHint },
    TimeSavedTally:       { schema: TimeSavedTallySchema,       component: REGISTRY.TimeSavedTally!.Component,       description: REGISTRY.TimeSavedTally.claudeToolHint },
  },

  initialConfig,

  promptHints: {
    role: 'personalization assistant for a YouTube clone — feeds of videos, channels, watch view',
    examples: [
      '"green dark theme, hide shorts" → update_theme + remove_section',
      '"more chill jazz" (one-off, additive) → request_more_content',
      // PERSISTENT / scheduled topic rules → write them onto the grid section so
      // they re-apply without another LLM call. CURATE several concrete queries +
      // real channels (don\'t pass one vague term). Read existing props.sources first.
      '"only academic videos from 9pm to 11:30pm" → update_section on the VideoGrid: props.sources = [{ queries: ["university full lecture", "academic talk", "course lecture"], creators: ["MIT OpenCourseWare", "3Blue1Brown", "Veritasium"], schedule: { start: "21:00", end: "23:30" } }] (start/end are 24h "HH:MM" local, minute precision)',
      '"always show classical piano in this row" → update_section: props.sources = [{ queries: ["classical piano performance", "piano sonata"], creators: ["HAUSER", "Rousseau"] }] (no schedule = always)',
      // PIN a referenced video: when the message has a "[Referenced videos]"
      // block (the visitor @-mentioned cards), use those id/title/channel.
      '"pin this to the Korean grammar row" (with a referenced video) → update_section on the RecommendedRow whose headline matches: props.pinned = [...existing pinned, { id: "<videoId from the referenced video>", title: "<its title>", channel: "<its channel>" }]. "unpin"/"remove it" → drop that entry from props.pinned.',
      // NAMED rows = one RecommendedRow each, with a descriptive `headline`.
      '"first row korean grammar lessons, rows beneath korean variety shows" → add_section RecommendedRow { headline: "Korean grammar lessons", sources: [{ queries: ["korean grammar lesson","learn korean grammar"], creators: ["GO! Billy Korean","Talk To Me In Korean"] }] } at the top, then add_section RecommendedRow { headline: "Korean variety shows", sources: [{ queries: ["korean variety show","런닝맨"], creators: ["tvN"] }] } below it — one RecommendedRow per named row.',
      // PERSISTENT per-mode caption preference → one SubtitleTrack section.
      '"I want videos in this mode always translated from english to korean" → add_section SubtitleTrack { primary: "en", secondary: "ko", visible: true } (or update_section if one already exists — at most one per mode)',
    ],
  },
  persistence: stubPersistence,
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});
