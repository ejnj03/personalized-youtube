// Host-agnostic "content rules" primitive.
//
// A SourceRule is a declarative spec a surface can evaluate WITHOUT an LLM call:
// fetch some content for a search query, optionally narrowed by title tags and
// gated to a local time window. Hosts store an array of these on a section
// (YouTube: VideoGrid.sources; Spotify: CuratedRow.sources) so the LLM writes
// them once and the surface re-applies them forever — including flipping on/off
// as time windows open and close.
//
// This module is pure (schema + evaluator, no React, no fetch). The client-side
// runtime that drives it lives in client/media/useSourceRules.

import { z } from 'zod';

// 24-hour local clock time, minute precision: "HH:MM" (e.g. "21:30", "07:05").
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h "HH:MM", e.g. "21:30".');

export const SourceScheduleSchema = z.object({
  start: HHMM.describe('Window start — visitor-local 24h "HH:MM" (minute precision, e.g. "21:30").'),
  end: HHMM.describe(
    'Window end, EXCLUSIVE — visitor-local 24h "HH:MM". Wraps midnight when end ≤ start (e.g. "22:00"→"06:00" = 10pm–6am).',
  ),
});
export type SourceSchedule = z.infer<typeof SourceScheduleSchema>;

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':');
  return (parseInt(h ?? '0', 10) || 0) * 60 + (parseInt(m ?? '0', 10) || 0);
}

export const SourceRuleSchema = z.object({
  // CURATE this: expand the visitor's request into several concrete search
  // phrases the surface should actually run. These exact strings are saved and
  // searched verbatim — no further LLM call. e.g. "academic videos" →
  // ["university full lecture", "MIT OpenCourseWare", "academic talk"].
  queries: z
    .array(z.string())
    .min(1)
    .describe(
      'CURATED list of concrete search phrases to run (the agent expands the request into several). These exact strings are searched verbatim, results merged. e.g. for "academic videos": ["university full lecture", "course lecture", "academic talk"].',
    ),
  // CURATE this: specific named sources to also pull from, searched as-is —
  // YouTube channels / youtubers, or music artists / albums. e.g.
  // ["3Blue1Brown","Veritasium","MIT OpenCourseWare"] or ["Radiohead","Bill Evans"].
  creators: z
    .array(z.string())
    .default([])
    .describe(
      'CURATED specific sources to also pull from, searched as-is: YouTube channels/youtubers, or music artists/albums. e.g. ["3Blue1Brown","Veritasium"] or ["Bill Evans","Kind of Blue"].',
    ),
  topN: z.number().int().positive().default(8).describe('How many top results to take from EACH query/creator term.'),
  tags: z
    .array(z.string())
    .default([])
    .describe('Optional words that must ALL appear in a result title — narrows the merged results further.'),
  schedule: SourceScheduleSchema.optional().describe(
    'Optional per-rule time window when THIS rule applies. Omit = whenever the section is shown.',
  ),
});
export type SourceRule = z.infer<typeof SourceRuleSchema>;

/** All search terms a rule should run: its curated queries + named creators. */
export function ruleTerms(rule: SourceRule): string[] {
  return [...rule.queries, ...(rule.creators ?? [])];
}

/**
 * Build the array-of-rules field for a host's section schema, with a host-
 * tuned top-level description (what the row represents). Use in a section's
 * Zod props:  `sources: sourceRulesField('Curated music rules for this row …')`.
 */
export function sourceRulesField(description?: string) {
  return z
    .array(SourceRuleSchema)
    .default([])
    .describe(
      description ??
        'Curated content rules for this surface. Each rule = a search query + optional title tags + optional time window. Use this (NOT a one-off fetch tool) for PERSISTENT/scheduled requests like "only show jazz from 9–11pm".',
    );
}

/** True when `now`'s local time-of-day (minute precision) is within the window. No schedule = always on. */
export function isScheduleActiveNow(schedule: SourceSchedule | undefined, now: Date): boolean {
  if (!schedule?.start || !schedule?.end) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = hhmmToMinutes(schedule.start);
  const end = hhmmToMinutes(schedule.end);
  if (start === end) return false; // zero-length window = never active
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // wraps midnight
}

/**
 * Filter rules to those active at `now`. A rule uses its own schedule, or
 * `fallback` (the section-level window) when it has none.
 */
export function activeSourceRules(
  rules: SourceRule[],
  now: Date,
  fallback?: SourceSchedule,
): SourceRule[] {
  return rules.filter((r) => isScheduleActiveNow(r.schedule ?? fallback, now));
}
