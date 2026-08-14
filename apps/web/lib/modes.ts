import { cookies } from 'next/headers';
import { sqlitePersistence } from '@showcase/sdk/sqlite';

// Shared, mode-aware persistence instance — the single swap point for the
// whole app. Backed by a local SQLite file rather than Supabase: the demo runs
// against a local dev server, so the store can live on the server's own disk.
// That keeps SSR personalized (getRenderedPage reads it during the server
// render) and keeps createNextHandler's server-side read/write working, neither
// of which a browser-only adapter could do. See issues/001.
export const persistence = sqlitePersistence();

// Cookie holding the visitor's active mode (save-slot) for SSR. Mirrors the
// `visitor_id` cookie: the page loader and the write routes read it to scope
// every read/write to one mode; the /api/modes routes set it on create/switch.
// (The Spotify clone is an SPA and threads modeId as a query/body param on
// every call; the YouTube clone is SSR, so it needs a cookie the server can
// read during the initial render.)
export const MODE_COOKIE = 'mode_id';

/**
 * Resolve the active modeId for a (visitor, slug). Resolution order:
 *   1. `explicit` (e.g. a ?modeId= query or request body field), if it's a
 *      real mode for this visitor;
 *   2. the `mode_id` cookie, if it's a real mode for this visitor;
 *   3. the visitor's oldest mode — the "Default" the 0002 migration backfilled;
 *   4. a freshly-created "Default" (first-ever load for this visitor).
 *
 * Listing once and validating against it guards against a stale cookie/param
 * pointing at a deleted mode (which would otherwise FK-fail on insert).
 * Always returns a real mode id so every read/write is mode-scoped.
 */
export async function resolveActiveModeId(
  visitorId: string,
  slug: string,
  explicit?: string | null,
): Promise<string> {
  const modes = await persistence.listModes(visitorId, slug);
  const valid = new Set(modes.map((m) => m.id));

  if (explicit && valid.has(explicit)) return explicit;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(MODE_COOKIE)?.value;
  if (fromCookie && valid.has(fromCookie)) return fromCookie;

  if (modes[0]) return modes[0].id;

  const created = await persistence.createMode(visitorId, slug, 'Default');
  return created.id;
}
