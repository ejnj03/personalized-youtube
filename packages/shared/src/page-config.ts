import { z } from 'zod';
import { ThemeSchema } from './schemas/theme';
import { SectionSchema } from './schemas/sections';

// ─── Re-exports from SDK ────────────────────────────────────────────────
// The host-agnostic patch model + fold lives in @showcase/sdk. We re-export
// here so existing YT-clone imports (`from '@showcase/shared'`) keep working
// without any caller changes. Pull from the server-safe '/core' entry, NOT
// the root barrel: this module is consumed in RSC/server code (queries/page.ts
// calls applyPatches during render), and the root barrel is 'use client'.

export { applyPatch, applyPatches } from '@showcase/sdk/core';
export type { Patch, ApplyPatchOptions } from '@showcase/sdk/core';

// ─── YouTube-specific schemas (stay in shared) ──────────────────────────

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
  hideWatched: z.boolean().default(false),
  showWatchedOverlay: z.boolean().default(false),
  chapterFilters: z.array(z.string()).default([]),
  autoSkip: z.boolean().default(false),
  moodFilter: z.string().optional(),
  requireLanguage: z.string().optional(),
  allowChannels: z.array(z.string()).default([]),
  requireTitleMatches: z.array(z.string()).default([]),
  excludeTitleMatches: z.array(z.string()).default([]),
  hideLive: z.boolean().default(false),
  onlyLive: z.boolean().default(false),
});
export type FilterState = z.infer<typeof FilterStateSchema>;

export const SortStateSchema = z.object({
  by: z.enum(['recommended', 'recent', 'popular', 'duration', 'density', 'mood']).default('recommended'),
  order: z.enum(['asc', 'desc']).default('desc'),
  secondary: z.enum(['recommended', 'recent', 'popular', 'duration', 'density']).optional(),
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
