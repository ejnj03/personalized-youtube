// Server-side cache for the YouTube home feed.
//
// Without this, every page reload calls youtubei.js cold — that's a fresh
// /browse call to YouTube + parse. Wall-clock cost: 4–10s on a warm cookie
// jar, longer when the keychain prompt is involved. With this cache, repeat
// reloads land in <50ms.
//
// All visitors of this server share the same cached entry because the
// underlying Chrome cookies belong to the *server's machine*, not the
// visitor — so all visitors see the same logged-in account's feed anyway.
// Cache key is therefore a single 'home' constant; we don't key by visitor.
//
// 10-minute TTL is short enough that re-clicking "Home" or refreshing
// doesn't show stale data for long; long enough that page reloads during
// a demo session stay fast.
//
// Invalidation: `clearHomeFeedCache()` is called by the cookie loader on
// failure, and exposed for callers that want a forced refresh.

import type { HomeFeedResult } from './client';

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const KEY = 'home';

interface CacheEntry {
  result: HomeFeedResult;
  expiresAt: number;
}

// globalThis-backed so the cache survives Next.js dev module re-evaluation
// (a plain module-level Map resets between requests in dev) and is shared
// across route bundles in one process.
const cache = ((globalThis as typeof globalThis & {
  __ytHomeFeedCache?: Map<string, CacheEntry>;
}).__ytHomeFeedCache ??= new Map<string, CacheEntry>());

export function getCachedHomeFeed(): HomeFeedResult | null {
  const e = cache.get(KEY);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(KEY);
    return null;
  }
  return e.result;
}

export function setCachedHomeFeed(result: HomeFeedResult): void {
  // Only cache successful fetches — we don't want to memoize a transient
  // 'unavailable' so the next request re-tries with fresh state.
  if (result.kind !== 'ok') return;
  cache.set(KEY, { result, expiresAt: Date.now() + TTL_MS });
}

export function clearHomeFeedCache(): void {
  cache.delete(KEY);
}

// ─── Generic keyed TTL cache ─────────────────────────────────────────────
// Same shape as the home-feed cache above, but keyed — for the other
// youtubei reads (library, playlists, subscriptions, search, comments, video
// info). Like the home feed, the underlying Chrome cookies belong to the
// server's machine, so all visitors share one account → cache is global, not
// per-visitor. Mirrors the spotify clone's Map<key,{value,expiresAt}> caches.

// Suggested TTLs (ms). Account/content reads change slowly; per-video reads a
// bit faster. Tune freely — short enough to feel live, long enough to be fast.
export const CACHE_TTL = {
  library: 10 * 60 * 1000,      // saved-playlist list
  playlist: 30 * 60 * 1000,     // a playlist's video preview
  subscriptions: 10 * 60 * 1000,
  search: 10 * 60 * 1000,
  comments: 10 * 60 * 1000,
  videoInfo: 30 * 60 * 1000,
  browse: 10 * 60 * 1000,       // chip/category browses (NOT continuations)
  captions: 24 * 60 * 60 * 1000, // transcript anchor + translations (stable; pricey to regen)
} as const;

interface KeyedEntry<T> {
  value: T;
  expiresAt: number;
}
const keyed = ((globalThis as typeof globalThis & {
  __ytKeyedCache?: Map<string, KeyedEntry<unknown>>;
}).__ytKeyedCache ??= new Map<string, KeyedEntry<unknown>>());

/**
 * Memoize an async fetcher under `key` for `ttlMs`. On a fresh hit returns the
 * cached value without calling `fetcher`; otherwise fetches, conditionally
 * stores (default: always), and returns. `shouldCache` lets callers skip
 * memoizing transient failures (e.g. only cache `kind === 'ok'`).
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = keyed.get(key) as KeyedEntry<T> | undefined;
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  const value = await fetcher();
  if (shouldCache(value)) keyed.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Drop cached entries. No arg → clear all; a prefix → clear that namespace. */
export function clearCache(prefix?: string): void {
  if (prefix === undefined) {
    keyed.clear();
    return;
  }
  for (const k of keyed.keys()) {
    if (k.startsWith(prefix)) keyed.delete(k);
  }
}
