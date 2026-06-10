'use client';

import { useEffect, useState } from 'react';
import { activeSourceRules, ruleTerms, type SourceRule, type SourceSchedule } from '../../core/source-rules';

export interface UseSourceRulesOptions<T> {
  /** The rules (a section's `sources`). */
  rules: SourceRule[];
  /** Section-level fallback window for rules without their own schedule. */
  fallbackSchedule?: SourceSchedule;
  /**
   * Host fetcher for ONE search term — a single query or creator/artist name.
   * The hook fans this out across every term of every active rule (a YT search,
   * a Spotify search, …) and merges the results. Keep it one-term simple.
   */
  provideContent: (term: string) => Promise<T[]>;
  /** Stable key per item — for merge-dedupe across terms/rules. */
  itemKey: (item: T) => string;
  /** Optional title accessor — enables a rule's `tags` to filter by title. */
  itemTitle?: (item: T) => string;
}

export interface UseSourceRulesResult<T> {
  /** Merged items from the active rules, or null when no rule is active (host shows its default). */
  items: T[] | null;
  /** A fetch is in flight. */
  loading: boolean;
  /** Whether any rule is active right now. */
  active: boolean;
}

/**
 * Drive a surface from an array of SourceRules: evaluates which rules are active
 * (by their local-time windows), fetches each via `provideContent`, narrows by
 * `tags`, takes `topN`, and merges deduped — re-evaluating every minute so the
 * windows flip on/off on their own. Zero LLM calls to apply.
 *
 * Host-agnostic: only `provideContent` (and the item type T) differ per host.
 */
export function useSourceRules<T>({
  rules,
  fallbackSchedule,
  provideContent,
  itemKey,
  itemTitle,
}: UseSourceRulesOptions<T>): UseSourceRulesResult<T> {
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Re-render once a minute so schedule windows flip without user interaction.
  const [, setTick] = useState(0);

  const hasSchedule = !!fallbackSchedule || rules.some((r) => !!r.schedule);
  useEffect(() => {
    if (!hasSchedule) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    // Align the first re-eval to the next minute boundary so windows flip
    // crisply ON the minute (e.g. a "21:30" rule activates at 21:30:00, not up
    // to ~59s late), then re-eval every 60s thereafter.
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

  useEffect(() => {
    if (active.length === 0) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Fan out: every term (query OR creator) of every active rule → one search.
    // Each result set is narrowed by its owning rule's tags and capped at topN.
    Promise.all(
      active.flatMap((rule) => {
        const tags = (rule.tags ?? []).map((t) => t.toLowerCase());
        return ruleTerms(rule).map((term) =>
          provideContent(term)
            .then((arr) => {
              let out = arr;
              if (tags.length > 0 && itemTitle) {
                out = out.filter((it) => tags.every((t) => itemTitle(it).toLowerCase().includes(t)));
              }
              return out.slice(0, rule.topN);
            })
            .catch(() => [] as T[]),
        );
      }),
    )
      .then((arrays) => {
        if (cancelled) return;
        const merged = new Map<string, T>();
        for (const arr of arrays) {
          for (const it of arr) {
            const k = itemKey(it);
            if (!merged.has(k)) merged.set(k, it);
          }
        }
        setItems(Array.from(merged.values()));
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

  return { items, loading, active: active.length > 0 };
}
