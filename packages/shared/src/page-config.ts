import { z } from 'zod';
import { ThemeSchema } from './schemas/theme';
import { SectionSchema, type Section } from './schemas/sections';

export const FilterStateSchema = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  requireTags: z.array(z.string()).default([]),
  blockChannels: z.array(z.string()).default([]),
  minDurationSeconds: z.number().int().nonnegative().optional(),
  maxDurationSeconds: z.number().int().nonnegative().optional(),
  minRating: z.number().min(0).max(5).optional(),
  minSubscriberCount: z.number().int().nonnegative().optional(),
  maxSubscriberCount: z.number().int().nonnegative().optional(),
  // ── Watch-history / chapter-aware filters (general primitives, not just
  // the 6 designed scenarios). The LLM can compose these freely.
  // hideWatched: drop seen videos from the feed entirely (vs. just dimming).
  hideWatched: z.boolean().default(false),
  // showWatchedOverlay: dim+badge already-seen cards instead of hiding.
  showWatchedOverlay: z.boolean().default(false),
  // chapterFilters: kinds whose segments the player auto-skips. Open-ended
  // strings ('sponsor', 'intro', 'outro', 'recap', 'self-promo', etc.) so
  // new chapter sources can light up new categories without a schema change.
  chapterFilters: z.array(z.string()).default([]),
  // autoSkip: whether `chapterFilters` actually seek. False = highlight only.
  autoSkip: z.boolean().default(false),
  // moodFilter: only show videos whose computed mood matches this id. Set
  // by clicking a mood chip on the MoodBoard or via "show me focus stuff".
  moodFilter: z.string().optional(),
  // requireLanguage: heuristic over title characters. Drops videos whose
  // titles are dominated by a different script than the one named here.
  // Common values: 'en' | 'ko' | 'ja' | 'zh' | 'ar' | 'ru'.
  requireLanguage: z.string().optional(),
  // allowChannels: inverse of blockChannels. When non-empty, ONLY videos
  // whose channel name matches one of these survive. Useful for "only show
  // me Khan Academy, MIT OCW, 3Blue1Brown" style curation.
  allowChannels: z.array(z.string()).default([]),
  // requireTitleMatches: keep only videos whose titles match one of these
  // patterns (case-insensitive substring OR a /regex/ string like '/^how /i').
  requireTitleMatches: z.array(z.string()).default([]),
  // excludeTitleMatches: drop videos whose titles match any of these
  // patterns. Same shape as requireTitleMatches.
  excludeTitleMatches: z.array(z.string()).default([]),
  // hideLive: drop live/upcoming/premiere streams from the feed. Detected
  // from the duration string (YouTube serves 'LIVE'/'PREMIERE'/'UPCOMING'
  // there for non-finalized streams).
  hideLive: z.boolean().default(false),
  // onlyLive: inverse — only keep live/upcoming/premiere streams.
  onlyLive: z.boolean().default(false),
});
export type FilterState = z.infer<typeof FilterStateSchema>;

export const SortStateSchema = z.object({
  // 'density' sorts by Video.density (computed deep-dive score) so long-form
  // single-topic content rises. 'mood' groups by Video.mood and respects
  // moodOrder when present. The remaining keys are unchanged.
  by: z.enum(['recommended', 'recent', 'popular', 'duration', 'density', 'mood']).default('recommended'),
  order: z.enum(['asc', 'desc']).default('desc'),
  // Optional secondary key — e.g. sort by density desc, then duration desc.
  secondary: z.enum(['recommended', 'recent', 'popular', 'duration', 'density']).optional(),
  // For sort.by==='mood': order moods top-to-bottom. Defaults to alphabetical.
  moodOrder: z.array(z.string()).optional(),
});
export type SortState = z.infer<typeof SortStateSchema>;

export const PageConfigSchema = z.object({
  id: z.string(),
  slug: z.string(),
  theme: ThemeSchema,
  sections: z.array(SectionSchema),
  filter: FilterStateSchema.default({}),
  sort: SortStateSchema.default({}),
  meta: z.object({
    title: z.string().default('YouTube'),
    favicon: z.string().default('/favicon.ico'),
  }).default({}),
});
export type PageConfig = z.infer<typeof PageConfigSchema>;

export type Patch =
  | { op: 'update_section'; sectionId: string; patch: Record<string, unknown> }
  | { op: 'update_theme'; patch: Partial<z.infer<typeof ThemeSchema>> }
  | { op: 'set_filter'; filter: Partial<FilterState> }
  | { op: 'set_sort'; sort: Partial<SortState> }
  | {
      op: 'add_section';
      sectionType: string;
      props: Record<string, unknown>;
      position: { before?: string; after?: string; index?: number };
    }
  | { op: 'remove_section'; sectionId: string }
  | { op: 'reorder_sections'; order: string[] };

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === null) {
      delete out[key];
    } else if (
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export function applyPatch(config: PageConfig, patch: Patch): PageConfig {
  switch (patch.op) {
    case 'update_section': {
      const sections = config.sections.map((s) =>
        s.id === patch.sectionId
          ? ({ ...s, props: deepMerge(s.props as Record<string, unknown>, patch.patch) } as Section)
          : s,
      );
      return { ...config, sections };
    }
    case 'update_theme': {
      return {
        ...config,
        theme: deepMerge(config.theme as Record<string, unknown>, patch.patch as Record<string, unknown>) as PageConfig['theme'],
      };
    }
    case 'set_filter': {
      return { ...config, filter: deepMerge(config.filter as Record<string, unknown>, patch.filter as Record<string, unknown>) as FilterState };
    }
    case 'set_sort': {
      return { ...config, sort: deepMerge(config.sort as Record<string, unknown>, patch.sort as Record<string, unknown>) as SortState };
    }
    case 'remove_section': {
      return { ...config, sections: config.sections.filter((s) => s.id !== patch.sectionId) };
    }
    case 'reorder_sections': {
      const byId = new Map(config.sections.map((s) => [s.id, s] as const));
      const ordered = patch.order
        .map((id) => byId.get(id))
        .filter((s): s is Section => s !== undefined);
      // Append any sections not in the order list at the end (don't lose them)
      const orderedIds = new Set(patch.order);
      const trailing = config.sections.filter((s) => !orderedIds.has(s.id));
      return { ...config, sections: [...ordered, ...trailing] };
    }
    case 'add_section': {
      // Run the new section through Zod so schema defaults materialize.
      // This means Claude can `add_section { type: 'MoodBoard', props: {} }`
      // and get a fully-populated section back — no template needs to
      // re-implement defaults defensively.
      const draft = {
        id: `${patch.sectionType.toLowerCase()}_${Date.now()}`,
        type: patch.sectionType,
        props: patch.props ?? {},
      };
      const parsed = SectionSchema.safeParse(draft);
      const newSection = (parsed.success ? parsed.data : draft) as unknown as Section;
      const sections = [...config.sections];
      if (patch.position.before) {
        const idx = sections.findIndex((s) => s.id === patch.position.before);
        sections.splice(idx >= 0 ? idx : sections.length, 0, newSection);
      } else if (patch.position.after) {
        const idx = sections.findIndex((s) => s.id === patch.position.after);
        sections.splice(idx >= 0 ? idx + 1 : sections.length, 0, newSection);
      } else if (typeof patch.position.index === 'number') {
        sections.splice(patch.position.index, 0, newSection);
      } else {
        sections.push(newSection);
      }
      return { ...config, sections };
    }
    default:
      return config;
  }
}

export function applyPatches(base: PageConfig, patches: Patch[]): PageConfig {
  return patches.reduce(applyPatch, base);
}
