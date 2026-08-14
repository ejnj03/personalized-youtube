import { applyPatches, PageConfigSchema, type PageConfig, type Patch, type Short, type Video } from '@showcase/shared';
import { makeBaseConfig } from '../base-config';
import { getAdapter } from '../adapters';
import { persistence, resolveActiveModeId } from '../modes';

interface GetRenderedConfigArgs {
  slug: string;
  visitorId?: string;
  // Active save-slot. When omitted, resolveActiveModeId picks it from the
  // mode_id cookie / the visitor's Default mode.
  modeId?: string | null;
}

// Distribute real videos across every section that holds a video list. Keeps
// the YouTube clone shell (TopBar, Sidebar, chips, etc.) intact — only the
// feed payloads change so the entire visible page reflects the real account,
// not just the main grid.
function replaceFeedVideos(
  config: PageConfig,
  videos: Video[],
  shorts: Short[],
  chips?: Array<{ text: string; isSelected?: boolean }>,
): PageConfig {
  if (videos.length === 0) return config;
  // Distribute the real feed so each row holds DISTINCT videos:
  //   ContinueWatching = first 6
  //   Recommended      = next 6
  //   VideoGrid        = remainder (or full feed if too few for the rows)
  // ShortsRow gets real shorts when available; otherwise left untouched so
  // the original mock shorts remain visible (so the "hide shorts" demo still works).
  const continueSlice = videos.slice(0, 6);
  const recommendedSlice = videos.slice(6, 12);
  const gridSlice = videos.length > 12 ? videos.slice(12) : videos;
  // Build the active chip list: prefer the real YouTube labels (which are
  // personalized to the account) when available; always include "All" first.
  const realChipList = Array.isArray(chips) && chips.length > 0
    ? ['All', ...chips.filter((c) => c.text !== 'All').map((c) => c.text)]
    : null;
  const activeChip = chips?.find((c) => c.isSelected)?.text ?? 'All';

  const sections = config.sections.map((s) => {
    if (s.type === 'VideoGrid') {
      return { ...s, props: { ...s.props, videos: gridSlice } };
    }
    if (s.type === 'RecommendedRow') {
      return { ...s, props: { ...s.props, videos: recommendedSlice } };
    }
    if (s.type === 'ContinueWatchingRow') {
      return { ...s, props: { ...s.props, videos: continueSlice } };
    }
    if (s.type === 'ShortsRow' && shorts.length > 0) {
      return { ...s, props: { ...s.props, shorts } };
    }
    if (s.type === 'CategoryChips' && realChipList) {
      return { ...s, props: { ...s.props, chips: realChipList, active: activeChip } };
    }
    return s;
  });
  return { ...config, sections };
}

export interface YtChipMeta {
  text: string;
  params: string | null;
}

export async function getRenderedPage(
  { slug, visitorId, modeId }: GetRenderedConfigArgs,
): Promise<{ config: PageConfig; ytContinuation: string | null; ytChips: YtChipMeta[] }> {
  // The baseline is static data and now lives in code (lib/base-config.ts),
  // not a database row — so rendering the default page needs no backend and
  // no seed step. makeBaseConfig already parses through PageConfigSchema, so
  // newer fields with .default() are materialized.
  let config = makeBaseConfig();

  // Move RecommendedRow to render after VideoGrid so the main feed is the
  // primary entry point rather than the recommended carousel. Handles pages
  // seeded before the section-order change without requiring a re-seed.
  {
    const grid = config.sections.findIndex((s) => s.type === 'VideoGrid');
    const rec = config.sections.findIndex((s) => s.type === 'RecommendedRow');
    if (grid !== -1 && rec !== -1 && rec < grid) {
      const next = [...config.sections];
      const [recSection] = next.splice(rec, 1);
      const gridAfterSplice = next.findIndex((s) => s.type === 'VideoGrid');
      if (recSection !== undefined && gridAfterSplice !== -1) {
        next.splice(gridAfterSplice + 1, 0, recSection);
        config = { ...config, sections: next };
      }
    }
  }

  let ytContinuation: string | null = null;
  let ytChips: YtChipMeta[] = [];

  // Pull live videos from the youtubei.js adapter and substitute them into the
  // row sections + grid. If the adapter can't reach YouTube it returns an
  // empty feed and the seeded base config is served as-is.
  try {
    const feed = await getAdapter().getFeed();
    if (feed.videos.length > 0) {
      config = replaceFeedVideos(config, feed.videos, feed.shorts ?? [], feed.chips);
      const maybeCont = (feed as { continuation?: unknown }).continuation;
      if (typeof maybeCont === 'string' && maybeCont.length > 0) ytContinuation = maybeCont;
      if (Array.isArray(feed.chips)) {
        ytChips = feed.chips.map((c) => ({ text: c.text, params: c.params }));
      }
    }
  } catch (err) {
    console.warn('[page] youtube adapter threw; serving seeded base config', err);
  }

  if (!visitorId) return { config, ytContinuation, ytChips };

  // Scope patches to the visitor's ACTIVE mode (save-slot). Without the
  // mode filter this would fold patches from every mode together.
  const activeModeId = await resolveActiveModeId(visitorId, slug, modeId);

  // Read through the shared adapter rather than querying a table directly, so
  // SSR and the chat handler always agree on where state lives. (There is no
  // longer a `visitors` row to upsert — the store keys on visitorId itself.)
  const patches: Patch[] = await persistence.read(visitorId, slug, activeModeId);

  return { config: applyPatches(config, patches), ytContinuation, ytChips };
}

// Backward-compat shim: existing callers (api/page, api/chat) only need the
// PageConfig and were unaware of YouTube continuation tokens.
export async function getRenderedConfig(args: GetRenderedConfigArgs): Promise<PageConfig> {
  const { config } = await getRenderedPage(args);
  return config;
}

// Re-export so route handlers can resolve/scope the active mode consistently.
export { resolveActiveModeId } from '../modes';
