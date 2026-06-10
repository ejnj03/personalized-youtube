import type { ChatTurn, Mode, PersistenceAdapter } from '../../core/contract';
import type { Patch, PageConfig } from '../../core/patch';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabasePersistenceOptions {
  /** Table holding patches. Default: 'preferences'. */
  preferencesTable?: string;
  /** Table mapping slug → site_id. Default: 'sites'. */
  sitesTable?: string;
  /** Table holding chat turns. Default: 'chat_turns'. */
  chatTurnsTable?: string;
  /** Table holding modes (parallel save-slots). Default: 'modes'. */
  modesTable?: string;
}

/**
 * Supabase-backed persistence adapter.
 *
 * Schema expectations:
 *   sites:        { id (uuid), slug (text) }
 *   preferences:  { visitor_id (text), site_id (uuid), patch (jsonb), created_at (timestamp) }
 *
 * Pass any Supabase client; the adapter uses it as-is. Server-only — wire
 * it from your route handler with an admin/service-role client.
 *
 * Install peer dep separately:
 *   pnpm add @supabase/supabase-js
 *
 * @example
 *   import { supabasePersistence } from '@showcase/sdk/supabase';
 *   import { createClient } from '@supabase/supabase-js';
 *   const supabase = createClient(URL, SERVICE_KEY);
 *   const persistence = supabasePersistence(supabase);
 */
export function supabasePersistence(
  client: SupabaseClient,
  options: SupabasePersistenceOptions = {},
): PersistenceAdapter {
  const prefsTable = options.preferencesTable ?? 'preferences';
  const sitesTable = options.sitesTable ?? 'sites';
  const turnsTable = options.chatTurnsTable ?? 'chat_turns';
  const modesTable = options.modesTable ?? 'modes';

  const siteIdCache = new Map<string, string>();
  const ensuredVisitors = new Set<string>();

  async function resolveSiteId(slug: string): Promise<string | null> {
    const cached = siteIdCache.get(slug);
    if (cached) return cached;
    const { data } = await client.from(sitesTable).select('id').eq('slug', slug).single();
    if (!data?.id) return null;
    siteIdCache.set(slug, data.id);
    return data.id;
  }

  // The preferences/chat_turns tables FK to a `visitors` row. The SDK manages
  // visitor ids on the client (localStorage or cookie), so the server may
  // receive an id that doesn't exist yet. Upsert on first use, then cache.
  async function ensureVisitor(visitorId: string): Promise<void> {
    if (ensuredVisitors.has(visitorId)) return;
    const { error } = await client
      .from('visitors')
      .upsert({ id: visitorId, last_seen: new Date().toISOString() }, { onConflict: 'id' });
    if (error) {
      console.error('[supabasePersistence.ensureVisitor] upsert failed:', error);
      return;
    }
    ensuredVisitors.add(visitorId);
  }

  return {
    async read(visitorId, slug, modeId): Promise<Patch[]> {
      const siteId = await resolveSiteId(slug);
      if (!siteId) return [];
      const { data } = await client
        .from(prefsTable)
        .select('patch')
        .eq('visitor_id', visitorId)
        .eq('site_id', siteId)
        .eq('mode_id', modeId)
        .order('created_at', { ascending: true });
      return (data ?? []).map((row) => row.patch as Patch);
    },
    async write(visitorId, slug, modeId, patches): Promise<void> {
      if (patches.length === 0) return;
      const siteId = await resolveSiteId(slug);
      if (!siteId) {
        console.warn(`[supabasePersistence.write] no site row for slug='${slug}' — skipping ${patches.length} patches`);
        return;
      }
      await ensureVisitor(visitorId);
      const { error } = await client.from(prefsTable).insert(
        patches.map((patch) => ({ visitor_id: visitorId, site_id: siteId, mode_id: modeId, patch })),
      );
      if (error) console.error('[supabasePersistence.write] insert failed:', error);
    },
    async reset(visitorId, slug, modeId): Promise<void> {
      const siteId = await resolveSiteId(slug);
      if (!siteId) return;
      await client
        .from(prefsTable)
        .delete()
        .eq('visitor_id', visitorId)
        .eq('site_id', siteId)
        .eq('mode_id', modeId);
      await client
        .from(turnsTable)
        .delete()
        .eq('visitor_id', visitorId)
        .eq('site_id', siteId)
        .eq('mode_id', modeId);
    },
    async recordTurn(visitorId, slug, modeId, turn): Promise<void> {
      const siteId = await resolveSiteId(slug);
      if (!siteId) {
        console.warn(`[supabasePersistence.recordTurn] no site row for slug='${slug}' — skipping`);
        return;
      }
      await ensureVisitor(visitorId);
      const { error } = await client.from(turnsTable).insert({
        visitor_id: visitorId,
        site_id: siteId,
        mode_id: modeId,
        user_message: turn.userMessage,
        assistant_message: turn.assistantMessage,
        tool_uses: turn.toolUses,
        created_at: turn.createdAt,
      });
      if (error) console.error('[supabasePersistence.recordTurn] insert failed:', error);
    },
    async readTurns(visitorId, slug, modeId, limit = 30): Promise<ChatTurn[]> {
      const siteId = await resolveSiteId(slug);
      if (!siteId) return [];
      const { data } = await client
        .from(turnsTable)
        .select('user_message, assistant_message, tool_uses, created_at')
        .eq('visitor_id', visitorId)
        .eq('site_id', siteId)
        .eq('mode_id', modeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      // Re-reverse so oldest comes first (chat panel renders chronologically).
      return (data ?? [])
        .slice()
        .reverse()
        .map((row) => ({
          userMessage: (row.user_message as string) ?? '',
          assistantMessage: (row.assistant_message as string) ?? '',
          toolUses: Array.isArray(row.tool_uses)
            ? (row.tool_uses as Array<{ name: string }>).map((u) => ({ name: u.name }))
            : [],
          createdAt: (row.created_at as string) ?? '',
        }));
    },
    async listModes(visitorId, slug): Promise<Mode[]> {
      const siteId = await resolveSiteId(slug);
      if (!siteId) return [];
      const { data } = await client
        .from(modesTable)
        .select('id, title, created_at')
        .eq('visitor_id', visitorId)
        .eq('site_id', siteId)
        .order('created_at', { ascending: true });
      return (data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        createdAt: (row.created_at as string) ?? '',
      }));
    },
    async createMode(visitorId, slug, title): Promise<Mode> {
      const siteId = await resolveSiteId(slug);
      if (!siteId) throw new Error(`[supabasePersistence.createMode] no site row for slug='${slug}'`);
      await ensureVisitor(visitorId);
      const { data, error } = await client
        .from(modesTable)
        .insert({ visitor_id: visitorId, site_id: siteId, title })
        .select('id, title, created_at')
        .single();
      if (error || !data) throw new Error(`[supabasePersistence.createMode] insert failed: ${error?.message}`);
      return {
        id: data.id as string,
        title: data.title as string,
        createdAt: (data.created_at as string) ?? '',
      };
    },
  };
}

// ─── loadSupabaseBaseConfig ──────────────────────────────────────────────

export interface LoadSupabaseBaseConfigOptions {
  /** Table holding seeded base configs. Default: 'sites'. */
  sitesTable?: string;
  /** Column holding the JSON config. Default: 'base_config'. */
  configColumn?: string;
}

/**
 * Fetch the seeded base PageConfig for a slug from Supabase.
 *
 * Companion to supabasePersistence: hosts using Supabase typically also
 * store their per-page initialConfig (sections, theme defaults, meta) in
 * a sites table. This helper reads that column.
 *
 * Returns null if the row is missing, the column is empty, or the query
 * errors — letting the host fall back to a stub `host.initialConfig`
 * without crashing the chat handler.
 *
 * Schema expectation:
 *   sites: { slug (text), <configColumn> (jsonb) }
 *
 * Server-only (uses an admin/service-role client).
 *
 * @example
 *   import { loadSupabaseBaseConfig } from '@showcase/sdk/supabase';
 *
 *   const baseConfig =
 *     (await loadSupabaseBaseConfig(supabaseAdmin(), host.initialConfig.slug))
 *     ?? host.initialConfig;
 */
export async function loadSupabaseBaseConfig(
  client: SupabaseClient,
  slug: string,
  options: LoadSupabaseBaseConfigOptions = {},
): Promise<PageConfig | null> {
  const sitesTable = options.sitesTable ?? 'sites';
  const configColumn = options.configColumn ?? 'base_config';

  try {
    const { data, error } = await client
      .from(sitesTable)
      .select(configColumn)
      .eq('slug', slug)
      .single();
    if (error || !data) return null;
    const cfg = (data as unknown as Record<string, unknown>)[configColumn];
    if (!cfg || typeof cfg !== 'object') return null;
    return cfg as PageConfig;
  } catch {
    return null;
  }
}

// ─── setSupabaseBaseConfig ───────────────────────────────────────────────

export interface SetSupabaseBaseConfigOptions {
  /** Table holding seeded base configs. Default: 'sites'. */
  sitesTable?: string;
  /** Column holding the JSON config. Default: 'base_config'. */
  configColumn?: string;
  /**
   * Conflict-resolution column for upsert. Default: 'slug'.
   * Override if your sites table uses a different unique constraint.
   */
  onConflict?: string;
}

/**
 * Upsert a seeded base PageConfig for a slug into Supabase.
 *
 * Companion to loadSupabaseBaseConfig: hosts use this to bootstrap a new
 * slug, re-seed after a schema bump, or update the base config from an
 * admin script.
 *
 * If a row with this slug already exists, the config column is overwritten.
 * If no row exists, one is inserted with `{ slug, [configColumn]: config }`.
 *
 * Unlike `loadSupabaseBaseConfig` (returns null on failure for graceful
 * fallback), this throws on error — callers writing should know about
 * failures.
 *
 * Server-only (uses an admin/service-role client).
 *
 * @example
 *   import { setSupabaseBaseConfig } from '@showcase/sdk/supabase';
 *   await setSupabaseBaseConfig(supabaseAdmin(), 'streaming-platform', {
 *     id: 'streaming-platform',
 *     slug: 'streaming-platform',
 *     theme: {...},
 *     sections: [...],
 *     // ...
 *   });
 */
export async function setSupabaseBaseConfig(
  client: SupabaseClient,
  slug: string,
  config: PageConfig,
  options: SetSupabaseBaseConfigOptions = {},
): Promise<void> {
  const sitesTable = options.sitesTable ?? 'sites';
  const configColumn = options.configColumn ?? 'base_config';
  const onConflict = options.onConflict ?? 'slug';

  const { error } = await client
    .from(sitesTable)
    .upsert(
      { slug, [configColumn]: config },
      { onConflict },
    );
  if (error) {
    throw new Error(`setSupabaseBaseConfig: ${error.message}`);
  }
}
