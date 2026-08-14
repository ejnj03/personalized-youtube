'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { activeSourceRules, ruleTerms, type SourceRule, type SourceSchedule } from '../../core/source-rules';

/** What a term fetch returns: just items, or items + a pagination cursor. */
type Provided<T> = T[] | { items: T[]; cursor?: string | null };

export interface UseSourceRulesOptions<T> {
  /** The rules (a section's `sources`). */
  rules: SourceRule[];
  /** Section-level fallback window for rules without their own schedule. */
  fallbackSchedule?: SourceSchedule;
  /**
   * Host fetcher for ONE search term (a query or creator name). Return the
   * items, or `{ items, cursor }` to enable infinite scroll over that term.
   */
  provideContent: (term: string) => Promise<Provided<T>>;
  /**
   * Optional: fetch the NEXT page for a cursor returned by provideContent.
   * Providing this enables `loadMore()` / `hasMore` — the curated grid then
   * keeps loading more results for the same keywords as the visitor scrolls.
   */
  provideMore?: (cursor: string) => Promise<{ items: T[]; cursor?: string | null }>;
  /** Stable key per item — for merge-dedupe across terms/pages. */
  itemKey: (item: T) => string;
  /** Optional title accessor — enables a rule's `tags` to filter by title. */
  itemTitle?: (item: T) => string;
}

export interface UseSourceRulesResult<T> {
  /** Merged items from the active rules, or null when no rule is active. */
  items: T[] | null;
  /** A fetch (initial or loadMore) is in flight. */
  loading: boolean;
  /** Whether any rule is active right now. */
  active: boolean;
  /** Append the next page for each term that still has a cursor. No-op without provideMore. */
  loadMore: () => Promise<void>;
  /** Whether more pages are available (some term still has a cursor). */
  hasMore: boolean;
}

function normalize<T>(r: Provided<T>): { items: T[]; cursor: string | null } {
  return Array.isArray(r) ? { items: r, cursor: null } : { items: r.items, cursor: r.cursor ?? null };
}

/**
 * Drive a surface from an array of SourceRules: evaluate which rules are active
 * (by their local-time windows), fetch each term, narrow by `tags`, take `topN`,
 * merge deduped — re-evaluating every minute so windows flip on their own. When
 * `provideMore` is supplied, `loadMore()` paginates each term's cursor so the
 * surface can infinite-scroll the same keywords. Zero LLM calls to apply.
 */
export function useSourceRules<T>({
  rules,
  fallbackSchedule,
  provideContent,
  provideMore,
  itemKey,
  itemTitle,
}: UseSourceRulesOptions<T>): UseSourceRulesResult<T> {
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [, setTick] = useState(0);

  // term → its current pagination cursor (null when exhausted); plus the set of
  // item keys already shown, so loadMore can dedupe against everything.
  const cursorsRef = useRef<Map<string, string | null>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  const hasSchedule = !!fallbackSchedule || rules.some((r) => !!r.schedule);
  useEffect(() => {
    if (!hasSchedule) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const timeout = setTimeout(() => {
      setTick((t) => t + 1);
      interval = setInterval(() => setTick((t) => t + 1), 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [hasSchedule]);

  // Recomputed every render (incl. the minute-tick) so window flips are caught.
  const active = activeSourceRules(rules, new Date(), fallbackSchedule);
  const activeKey = JSON.stringify(active);

  function applyTags(out: T[], rule: SourceRule): T[] {
    if (rule.tags && rule.tags.length > 0 && itemTitle) {
      const tags = rule.tags.map((t) => t.toLowerCase());
      return out.filter((it) => tags.every((t) => itemTitle(it).toLowerCase().includes(t)));
    }
    return out;
  }

  useEffect(() => {
    if (active.length === 0) {
      setItems(null);
      setHasMore(false);
      cursorsRef.current = new Map();
      seenRef.current = new Set();
      return;
    }
    let cancelled = false;
    setLoading(true);
    const cursors = new Map<string, string | null>();
    Promise.all(
      active.flatMap((rule) =>
        ruleTerms(rule).map((term) =>
          provideContent(term)
            .then((r) => {
              const { items: got, cursor } = normalize(r);
              cursors.set(term, cursor);
              return applyTags(got, rule).slice(0, rule.topN);
            })
            .catch(() => {
              cursors.set(term, null);
              return [] as T[];
            }),
        ),
      ),
    )
      .then((arrays) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: T[] = [];
        for (const arr of arrays) {
          for (const it of arr) {
            const k = itemKey(it);
            if (!seen.has(k)) {
              seen.add(k);
              merged.push(it);
            }
          }
        }
        cursorsRef.current = cursors;
        seenRef.current = seen;
        setItems(merged);
        setHasMore(!!provideMore && [...cursors.values()].some((c) => !!c));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // active is captured via activeKey; refetch when the active set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const loadMore = useCallback(async () => {
    if (!provideMore) return;
    const cursors = cursorsRef.current;
    const pending = [...cursors.entries()].filter((e): e is [string, string] => !!e[1]);
    if (pending.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        pending.map(([term, cursor]) =>
          provideMore(cursor)
            .then((r) => ({ term, items: r.items, cursor: r.cursor ?? null }))
            .catch(() => ({ term, items: [] as T[], cursor: null })),
        ),
      );
      const seen = seenRef.current;
      const fresh: T[] = [];
      for (const r of results) {
        cursors.set(r.term, r.cursor);
        for (const it of r.items) {
          const k = itemKey(it);
          if (!seen.has(k)) {
            seen.add(k);
            fresh.push(it);
          }
        }
      }
      if (fresh.length > 0) setItems((cur) => [...(cur ?? []), ...fresh]);
      setHasMore([...cursors.values()].some((c) => !!c));
    } finally {
      setLoading(false);
    }
  }, [provideMore, itemKey]);

  return { items, loading, active: active.length > 0, loadMore, hasMore };
}
