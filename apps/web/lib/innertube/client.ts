// Innertube client wrapper.
//
// Builds a youtubei.js `Innertube` instance authenticated with cookies read
// from the user's local Chrome cookie store, and exposes `getHomeFeed()` —
// the only InnerTube method the showcase currently consumes.
//
// Tolerance contract:
//   - All public functions return discriminated unions or null. No throws.
//   - Every step (cookie read, Innertube.create, getHomeFeed, mapping)
//     surfaces failures as `{ kind: 'unavailable', reason: <string> }` so the
//     adapter selector can fall back to mock without crashing the page.
//   - Cookie values are never logged. Counts only.

import { Innertube } from 'youtubei.js';
import type { Video, Short } from '@showcase/shared';
import {
  composeCookieHeader,
  readYoutubeCookies,
  type Cookie,
} from './chrome-cookies';

interface InnertubeCacheEntry {
  instance: Innertube;
  authenticated: boolean;
  createdAt: number;
}

const INNERTUBE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let innertubeCache: InnertubeCacheEntry | null = null;

export interface InnertubeSession {
  instance: Innertube;
  authenticated: boolean;
}

export interface HomeFeedOk {
  kind: 'ok';
  videos: Video[];
  shorts: Short[];
  continuation: string | null;
  chips: YtChip[];
}

export interface HomeFeedUnavailable {
  kind: 'unavailable';
  reason: string;
}

export type HomeFeedResult = HomeFeedOk | HomeFeedUnavailable;

// ---------- Innertube instance management ----------

export async function createInnertube(): Promise<InnertubeSession | null> {
  const now = Date.now();
  if (innertubeCache !== null && now - innertubeCache.createdAt < INNERTUBE_TTL_MS) {
    return { instance: innertubeCache.instance, authenticated: innertubeCache.authenticated };
  }

  // Try authenticated mode first (local Chrome cookies). If unavailable
  // (no Chrome / no cookies / on Vercel / cookies expired), fall back to
  // anonymous mode — works for search, video info, comments, browse, and
  // sidebar suggestions. Only personalized endpoints (home feed, subs)
  // require authentication.
  let cookieHeader = '';
  const cookieResult = await readYoutubeCookies();
  if (cookieResult.kind === 'ok') {
    cookieHeader = composeCookieHeader(cookieResult.cookies);
  } else {
    console.warn(`[innertube] cookies unavailable: ${cookieResult.reason} — falling back to anonymous`);
  }

  const authenticated = cookieHeader.length > 0;

  try {
    const instance = await Innertube.create({
      ...(authenticated ? { cookie: cookieHeader } : {}),
      retrieve_player: false,
      generate_session_locally: true,
      lang: 'en',
      location: 'US',
    });
    innertubeCache = { instance, authenticated, createdAt: now };
    return { instance, authenticated };
  } catch (err) {
    console.warn(`[innertube] Innertube.create failed: ${(err as Error).message}`);
    return null;
  }
}

export function clearInnertubeCache(): void {
  innertubeCache = null;
}

// ---------- youtubei.js -> Video shape mapping ----------

interface AnyFeedNode {
  type?: string;
  video_id?: string;
  content_id?: string;
  title?: { text?: string; toString?: () => string };
  duration?: { text?: string; seconds?: number };
  length_text?: { text?: string };
  thumbnails?: { url: string; width: number; height: number }[];
  thumbnail?: { url: string; width: number; height: number }[];
  best_thumbnail?: { url: string };
  author?: {
    name?: string;
    is_verified?: boolean;
    thumbnails?: { url: string }[];
    best_thumbnail?: { url: string };
  };
  view_count?: { text?: string };
  short_view_count?: { text?: string };
  published?: { text?: string };
  description_snippet?: { text?: string };
  description?: string;
  is_live?: boolean;
  // lockup / shorts shape — accessed defensively.
  content_image?: unknown;
  metadata?: unknown;
  content_type?: string;
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function tryToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null) {
    const obj = v as { text?: unknown; toString?: () => string };
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.toString === 'function') {
      try {
        const out = obj.toString();
        // Object.prototype.toString returns "[object Object]" — treat as empty.
        if (out !== '[object Object]') return out;
      } catch {
        // ignore
      }
    }
  }
  return '';
}

function pickBestThumbnail(thumbs: { url: string; width?: number }[] | undefined): string {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return '';
  // Highest-width wins; fall back to last entry if widths are missing.
  let bestUrl = '';
  let bestWidth = -1;
  for (const t of thumbs) {
    const w = typeof t.width === 'number' ? t.width : 0;
    if (w >= bestWidth && typeof t.url === 'string') {
      bestUrl = t.url;
      bestWidth = w;
    }
  }
  if (bestUrl.length > 0) return bestUrl;
  const last = thumbs[thumbs.length - 1];
  return typeof last?.url === 'string' ? last.url : '';
}

// "1.5B views" / "1,234,567 views" / "7.7K watching" / undefined -> integer.
export function parseViewCount(s: string | undefined): number {
  if (typeof s !== 'string') return 0;
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  const match = /([0-9][0-9,]*\.?[0-9]*)\s*([KkMmBb])?/.exec(trimmed);
  if (!match) return 0;
  const numStr = match[1];
  const suffix = match[2];
  if (!numStr) return 0;
  const base = Number.parseFloat(numStr.replace(/,/g, ''));
  if (!Number.isFinite(base)) return 0;
  let multiplier = 1;
  if (suffix === 'K' || suffix === 'k') multiplier = 1_000;
  else if (suffix === 'M' || suffix === 'm') multiplier = 1_000_000;
  else if (suffix === 'B' || suffix === 'b') multiplier = 1_000_000_000;
  return Math.round(base * multiplier);
}

// Map a youtubei.js feed node into our flat `Video` shape. Returns null if
// the node is not a video (playlist, channel, shorts shelf, etc.) or if the
// id is missing.
function mapNodeToVideo(node: unknown): Video | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as AnyFeedNode;

  const type = typeof n.type === 'string' ? n.type : '';
  // Accept Video (search/feed), GridVideo (channel/feed), CompactVideo
  // (watch-page sidebar), and LockupView with content_type === 'VIDEO'.
  // Skip everything else (playlists, channels, ads, shorts shelves).
  let id = '';
  if (type === 'LockupView') {
    if (n.content_type !== 'VIDEO') return null;
    id = asString(n.content_id);
  } else if (
    type === 'Video' ||
    type === 'GridVideo' ||
    type === 'CompactVideo' ||
    type === 'WatchCardCompactVideo' ||
    type === 'PlaylistVideo' ||
    type === 'PlaylistPanelVideo'
  ) {
    id = asString(n.video_id);
  } else {
    // Unknown node type — try video_id as a generic last resort, otherwise skip.
    id = asString(n.video_id);
    if (id.length === 0) return null;
  }

  if (id.length === 0) return null;
  // Belt-and-suspenders id filter. Playlists/radio mixes start with PL/RD.
  if (id.startsWith('PL') || id.startsWith('RD')) return null;

  const title = tryToString(n.title);
  if (title.length === 0) return null;

  const thumbs = Array.isArray(n.thumbnails)
    ? n.thumbnails
    : Array.isArray(n.thumbnail)
      ? n.thumbnail
      : [];
  const thumbnail =
    pickBestThumbnail(thumbs) ||
    (typeof n.best_thumbnail?.url === 'string' ? n.best_thumbnail.url : '');

  const duration =
    (typeof n.duration?.text === 'string' && n.duration.text) ||
    (typeof n.length_text?.text === 'string' && n.length_text.text) ||
    (n.is_live === true ? 'LIVE' : '0:00');

  const viewsText = tryToString(n.view_count) || tryToString(n.short_view_count);
  const views = parseViewCount(viewsText);

  const postedAgo = tryToString(n.published);

  const channelName = typeof n.author?.name === 'string' ? n.author.name : '';
  const channelAvatar =
    pickBestThumbnail(n.author?.thumbnails) ||
    (typeof n.author?.best_thumbnail?.url === 'string'
      ? n.author.best_thumbnail.url
      : '');
  const channelVerified = n.author?.is_verified === true;

  const description =
    typeof n.description === 'string'
      ? n.description
      : tryToString(n.description_snippet);

  return {
    id,
    title,
    channel: {
      name: channelName,
      avatar: channelAvatar,
      verified: channelVerified,
      subscriberCount: 0,
    },
    thumbnail,
    duration,
    views,
    postedAgo,
    tags: [],
    description,
    category: '',
  };
}

// LockupView nodes coming from continuation responses (the new "view model"
// shape) sit alongside richly-typed Video / GridVideo nodes from the same
// youtubei.js parse. The library exposes them through `feed.videos` (typed
// `ObservedArray`) for the legacy types, and through `feed.contents` /
// shelves for the lockup variants. We walk both surfaces and dedupe by id.
function harvestNodes(feed: {
  videos?: unknown[];
  shelves?: unknown[];
  page_contents?: unknown;
  contents?: unknown;
}): unknown[] {
  const out: unknown[] = [];

  if (Array.isArray(feed.videos)) {
    for (const v of feed.videos) out.push(v);
  }

  // Shelves can be ReelShelf / RichShelf / Shelf. RichShelf has `.contents`
  // with mixed nodes; ReelShelf is shorts and we skip it from the flat catalog.
  if (Array.isArray(feed.shelves)) {
    for (const shelf of feed.shelves) {
      if (typeof shelf !== 'object' || shelf === null) continue;
      const s = shelf as { type?: string; contents?: unknown };
      if (s.type === 'ReelShelf') continue;
      if (Array.isArray(s.contents)) {
        for (const c of s.contents) out.push(c);
      }
    }
  }

  // RichGrid (`page_contents` for HomeFeed) wraps `richItemRenderer` parses;
  // youtubei.js exposes them as `.contents`. Walking it catches anything
  // `feed.videos` misses (lockups in particular).
  const pageContents = feed.page_contents;
  if (typeof pageContents === 'object' && pageContents !== null) {
    const pc = pageContents as { contents?: unknown };
    if (Array.isArray(pc.contents)) {
      for (const c of pc.contents) {
        if (typeof c !== 'object' || c === null) continue;
        const item = c as { content?: unknown; type?: string };
        // RichItem -> { content: <Video|LockupView|ReelItem|...> }
        if (item.content !== undefined && item.content !== null) {
          out.push(item.content);
        } else {
          out.push(item);
        }
      }
    }
  }

  return out;
}

// ---------- public API ----------

// Walk a youtubei /browse JSON response (raw — no library-level parsing) and
// pull out the lockupViewModel video entries. This is the same shape the
// Phase 5 mapper handled for the Electron sidecar; reused here because
// youtubei.js's high-level getHomeFeed() crashes on YouTube's newer node
// types (FlowStep, TalkToRecsView, ChipsShelfView, ...).
export interface YtChip {
  text: string;
  // Either a chip params token (sent back as `params`) or null for the
  // "All" chip which just refetches the unfiltered home feed.
  params: string | null;
  isSelected: boolean;
}

function extractLockupVideos(json: unknown): {
  videos: Video[];
  shorts: Short[];
  continuation: string | null;
  chips: YtChip[];
} {
  const out: Video[] = [];
  const shortsOut: Short[] = [];
  const chipsOut: YtChip[] = [];
  let nextToken: string | null = null;
  if (typeof json !== 'object' || json === null) {
    return { videos: out, shorts: shortsOut, continuation: null, chips: chipsOut };
  }

  type AnyObj = Record<string, unknown>;
  const seen = new Set<string>();
  const seenShorts = new Set<string>();
  const seenChipText = new Set<string>();

  function consumeShort(lock: AnyObj): void {
    // shape: shortsLockupViewModel { onTap.innertubeCommand.reelWatchEndpoint.videoId,
    //                                overlayMetadata.{primaryText,secondaryText}.content,
    //                                thumbnailViewModel.thumbnailViewModel.image.sources[] }
    const onTap = lock.onTap as AnyObj | undefined;
    const cmd = onTap?.innertubeCommand as AnyObj | undefined;
    const reel = cmd?.reelWatchEndpoint as AnyObj | undefined;
    const id = typeof reel?.videoId === 'string' ? reel.videoId : '';
    if (id.length === 0 || seenShorts.has(id)) return;

    const om = lock.overlayMetadata as AnyObj | undefined;
    const titleObj = om?.primaryText as AnyObj | undefined;
    const title = typeof titleObj?.content === 'string' ? titleObj.content : '';
    if (title.length === 0) return;
    const viewsObj = om?.secondaryText as AnyObj | undefined;
    const viewsStr = typeof viewsObj?.content === 'string' ? viewsObj.content : '';
    const views = parseViewCount(viewsStr);

    // Thumbnail nested twice: thumbnailViewModel.thumbnailViewModel.image.sources[]
    const thumbWrap = lock.thumbnailViewModel as AnyObj | undefined;
    const thumbInner = thumbWrap?.thumbnailViewModel as AnyObj | undefined;
    const image = thumbInner?.image as AnyObj | undefined;
    const sources = Array.isArray(image?.sources) ? (image!.sources as unknown[]) : [];
    let thumbnail = '';
    let bestW = -1;
    for (const s of sources) {
      if (typeof s !== 'object' || s === null) continue;
      const ss = s as { url?: unknown; width?: unknown };
      if (typeof ss.url !== 'string') continue;
      const w = typeof ss.width === 'number' ? ss.width : 0;
      if (w >= bestW) {
        thumbnail = ss.url;
        bestW = w;
      }
    }

    seenShorts.add(id);
    shortsOut.push({
      id,
      title,
      thumbnail,
      views,
      channel: { name: '', avatar: '', verified: false, subscriberCount: 0 },
    });
  }

  function tryRunsOrSimple(field: unknown): string {
    if (typeof field !== 'object' || field === null) return '';
    const f = field as AnyObj;
    if (typeof f.simpleText === 'string') return f.simpleText;
    const runs = f.runs;
    if (Array.isArray(runs) && runs.length > 0) {
      const first = runs[0] as AnyObj | undefined;
      if (typeof first?.text === 'string') return first.text;
    }
    return '';
  }

  // videoRenderer / gridVideoRenderer / compactVideoRenderer (legacy shape used
  // in /search responses + occasional shelf entries). Returns true if a video
  // was extracted, false otherwise.
  function consumeLegacyVideo(rend: AnyObj): boolean {
    const id = typeof rend.videoId === 'string' ? rend.videoId : '';
    if (id.length === 0 || seen.has(id)) return false;
    if (id.startsWith('PL') || id.startsWith('RD')) return false;

    const title = tryRunsOrSimple(rend.title);
    if (title.length === 0) return false;

    // thumbnails live at thumbnail.thumbnails[]
    const tb = rend.thumbnail as AnyObj | undefined;
    const thumbs = Array.isArray(tb?.thumbnails) ? (tb!.thumbnails as unknown[]) : [];
    const thumbnail = pickThumb(thumbs);

    const channelName = tryRunsOrSimple(rend.ownerText) || tryRunsOrSimple(rend.shortBylineText) || tryRunsOrSimple(rend.longBylineText);
    const viewsStr = tryRunsOrSimple(rend.viewCountText) || tryRunsOrSimple(rend.shortViewCountText);
    const views = parseViewCount(viewsStr);
    const postedAgo = tryRunsOrSimple(rend.publishedTimeText);
    const duration = tryRunsOrSimple(rend.lengthText) || '0:00';

    // Channel avatar (legacy videoRenderer): typically lives at
    //   channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail.thumbnails[]
    // Some shapes flatten it as `channelThumbnail.thumbnails[]`.
    const channelThumbWrapper = rend.channelThumbnailSupportedRenderers as AnyObj | undefined;
    const channelThumbWithLink = channelThumbWrapper?.channelThumbnailWithLinkRenderer as AnyObj | undefined;
    const channelThumbInner = (channelThumbWithLink?.thumbnail as AnyObj | undefined)
      ?? (rend.channelThumbnail as AnyObj | undefined);
    const avatarThumbs = Array.isArray(channelThumbInner?.thumbnails) ? channelThumbInner!.thumbnails as unknown[] : [];
    const channelAvatar = pickThumb(avatarThumbs);

    seen.add(id);
    out.push({
      id,
      title,
      channel: { name: channelName, avatar: channelAvatar, verified: false, subscriberCount: 0 },
      thumbnail,
      duration,
      views,
      postedAgo,
      tags: [],
      description: '',
      category: '',
    });
    return true;
  }

  function pickThumb(thumbs: unknown): string {
    if (!Array.isArray(thumbs) || thumbs.length === 0) return '';
    let best = '';
    let bestW = -1;
    for (const t of thumbs) {
      if (typeof t !== 'object' || t === null) continue;
      const tt = t as { url?: unknown; width?: unknown };
      if (typeof tt.url !== 'string') continue;
      const w = typeof tt.width === 'number' ? tt.width : 0;
      if (w >= bestW) {
        best = tt.url;
        bestW = w;
      }
    }
    if (best.length > 0) return best;
    const last = thumbs[thumbs.length - 1] as { url?: unknown };
    return typeof last?.url === 'string' ? last.url : '';
  }

  function consumeLockup(lock: AnyObj): void {
    const contentType = typeof lock.contentType === 'string' ? lock.contentType : '';
    if (contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return; // skip playlists / podcasts
    const id = typeof lock.contentId === 'string' ? lock.contentId : '';
    if (id.length === 0 || seen.has(id) || id.startsWith('PL') || id.startsWith('RD')) return;

    const meta = lock.metadata as AnyObj | undefined;
    const lmv = meta?.lockupMetadataViewModel as AnyObj | undefined;
    const titleObj = lmv?.title as AnyObj | undefined;
    const title = typeof titleObj?.content === 'string' ? titleObj.content : '';
    if (title.length === 0) return;

    // metadataRows hold channel + views/posted-ago; layout varies (live streams
    // omit the postedAgo part). Walk defensively.
    const cmv = (lmv?.metadata as AnyObj | undefined)?.contentMetadataViewModel as AnyObj | undefined;
    const rows = Array.isArray(cmv?.metadataRows) ? cmv!.metadataRows as unknown[] : [];

    function rowText(rowIdx: number, partIdx: number): string {
      const row = rows[rowIdx];
      if (typeof row !== 'object' || row === null) return '';
      const parts = (row as AnyObj).metadataParts;
      if (!Array.isArray(parts)) return '';
      const part = parts[partIdx];
      if (typeof part !== 'object' || part === null) return '';
      const text = (part as AnyObj).text;
      if (typeof text !== 'object' || text === null) return '';
      const c = (text as AnyObj).content;
      return typeof c === 'string' ? c : '';
    }

    const channelName = rowText(0, 0);
    const viewsStr = rowText(1, 0);
    const postedAgo = rowText(1, 1);
    let views = 0;
    if (viewsStr.length > 0) views = parseViewCount(viewsStr);

    // Channel avatar — lives deep at:
    //   metadata.lockupMetadataViewModel.image.decoratedAvatarViewModel.avatar.avatarViewModel.image.sources[]
    // YouTube's home/chip browse responses always carry it; we also detect a
    // verified-channel hint when the surrounding metadata flags it.
    const lmvImage = lmv?.image as AnyObj | undefined;
    const decorated = lmvImage?.decoratedAvatarViewModel as AnyObj | undefined;
    const innerAvatar = decorated?.avatar as AnyObj | undefined;
    const avatarVM = innerAvatar?.avatarViewModel as AnyObj | undefined;
    const avatarImage = avatarVM?.image as AnyObj | undefined;
    const avatarSources = Array.isArray(avatarImage?.sources) ? (avatarImage!.sources as unknown[]) : [];
    const channelAvatar = pickThumb(avatarSources);

    // Thumbnail lives at contentImage.thumbnailViewModel.image.sources[]
    const ci = lock.contentImage as AnyObj | undefined;
    const thumbVM = ci?.thumbnailViewModel as AnyObj | undefined;
    const image = thumbVM?.image as AnyObj | undefined;
    const sources = Array.isArray(image?.sources) ? (image!.sources as unknown[]) : [];
    const thumbnail = pickThumb(sources);

    // Duration — sometimes in overlays[].thumbnailBottomOverlayViewModel.badges
    let duration = '';
    const overlays = thumbVM?.overlays;
    if (Array.isArray(overlays)) {
      for (const ov of overlays) {
        if (typeof ov !== 'object' || ov === null) continue;
        const tbov = (ov as AnyObj).thumbnailBottomOverlayViewModel as AnyObj | undefined;
        const badges = Array.isArray(tbov?.badges) ? tbov!.badges as unknown[] : [];
        for (const b of badges) {
          if (typeof b !== 'object' || b === null) continue;
          const bvm = (b as AnyObj).thumbnailBadgeViewModel as AnyObj | undefined;
          const txt = bvm?.text;
          if (typeof txt === 'string' && /\d+:\d+/.test(txt)) {
            duration = txt;
            break;
          }
        }
        if (duration.length > 0) break;
      }
    }
    if (duration.length === 0) duration = '0:00';

    seen.add(id);
    out.push({
      id,
      title,
      channel: { name: channelName, avatar: channelAvatar, verified: false, subscriberCount: 0 },
      thumbnail,
      duration,
      views,
      postedAgo,
      tags: [],
      description: '',
      category: '',
    });
  }

  function consumeChip(rend: AnyObj): void {
    const textObj = rend.text as AnyObj | undefined;
    let label = '';
    if (typeof textObj?.simpleText === 'string') {
      label = textObj.simpleText;
    } else if (Array.isArray(textObj?.runs) && (textObj!.runs as unknown[]).length > 0) {
      const first = (textObj!.runs as unknown[])[0] as AnyObj | undefined;
      if (typeof first?.text === 'string') label = first.text;
    }
    if (label.length === 0 || seenChipText.has(label)) return;
    // YouTube currently exposes chip tokens via continuationCommand.token
    // (the legacy browseEndpoint.params path is empty as of 2026). We accept
    // either path defensively — `params` here just means "the opaque token
    // we send back to filter", regardless of which command shape carried it.
    const navEndpoint = rend.navigationEndpoint as AnyObj | undefined;
    const continuationCmd = navEndpoint?.continuationCommand as AnyObj | undefined;
    const browseEndpoint = navEndpoint?.browseEndpoint as AnyObj | undefined;
    const params =
      typeof continuationCmd?.token === 'string'
        ? continuationCmd.token
        : typeof browseEndpoint?.params === 'string'
          ? browseEndpoint.params
          : null;
    const isSelected = rend.isSelected === true;
    seenChipText.add(label);
    chipsOut.push({ text: label, params, isSelected });
  }

  // ── Scoped video/shorts walker ────────────────────────────────────────
  // The previous version walked the entire response tree looking for
  // lockupViewModel / videoRenderer anywhere. That picked up secondary
  // widgets (sidebar suggestions, "from your subscriptions", related-channel
  // shelves, etc.) which made chip-filtered browses return mixed content
  // that didn't reflect the chip's label.
  //
  // We now restrict video extraction to the main content array — exactly
  // the path the YouTube web client renders into the central column. Chips
  // and continuation tokens still walk the whole tree (they're metadata).
  function walkInScope(node: unknown): void {
    if (node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) walkInScope(item);
      return;
    }
    if (typeof node !== 'object') return;
    const obj = node as AnyObj;
    if (
      typeof obj.entityId === 'string' &&
      (obj.entityId as string).startsWith('shorts-shelf-item-') &&
      obj.overlayMetadata !== undefined
    ) {
      consumeShort(obj);
      return;
    }
    if (typeof obj.contentId === 'string' && typeof obj.contentType === 'string' && obj.metadata !== undefined) {
      consumeLockup(obj);
      return;
    }
    if (typeof obj.videoId === 'string' && obj.title !== undefined && obj.thumbnail !== undefined) {
      if (consumeLegacyVideo(obj)) return;
    }
    for (const v of Object.values(obj)) walkInScope(v);
  }

  // Whole-tree walk just for chip metadata + continuation token.
  function walkMetaOnly(node: unknown): void {
    if (node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) walkMetaOnly(item);
      return;
    }
    if (typeof node !== 'object') return;
    const obj = node as AnyObj;
    if ('chipCloudChipRenderer' in obj) {
      consumeChip(obj.chipCloudChipRenderer as AnyObj);
    }
    const ce = obj.continuationEndpoint as AnyObj | undefined;
    const cc = ce?.continuationCommand as AnyObj | undefined;
    if (typeof cc?.token === 'string' && nextToken === null) {
      nextToken = cc.token;
    }
    for (const v of Object.values(obj)) walkMetaOnly(v);
  }

  // The roots we treat as "the main feed". Order matters — initial-browse
  // shape first, then continuation shape, then a search-response shape.
  const root = json as AnyObj;
  const mainFeedRoots: unknown[] = [];

  // 1. Initial browse / chip-filtered browse:
  //    contents.twoColumnBrowseResultsRenderer.tabs[].tabRenderer.content.richGridRenderer.contents
  const contents1 = (root.contents as AnyObj | undefined)?.twoColumnBrowseResultsRenderer as AnyObj | undefined;
  const tabs = contents1?.tabs;
  if (Array.isArray(tabs)) {
    for (const t of tabs) {
      const tabRenderer = (t as AnyObj | undefined)?.tabRenderer as AnyObj | undefined;
      const content = tabRenderer?.content as AnyObj | undefined;
      const richGrid = content?.richGridRenderer as AnyObj | undefined;
      if (Array.isArray(richGrid?.contents)) mainFeedRoots.push(richGrid!.contents);
    }
  }

  // 2. Continuation responses (home re-fetch, scroll-pagination):
  //    onResponseReceivedActions[].appendContinuationItemsAction.continuationItems
  const actions = root.onResponseReceivedActions;
  if (Array.isArray(actions)) {
    for (const a of actions) {
      const append = (a as AnyObj | undefined)?.appendContinuationItemsAction as AnyObj | undefined;
      if (Array.isArray(append?.continuationItems)) mainFeedRoots.push(append!.continuationItems);
    }
  }

  // 3. Search response shape:
  //    contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[].itemSectionRenderer.contents
  const search1 = (root.contents as AnyObj | undefined)?.twoColumnSearchResultsRenderer as AnyObj | undefined;
  const primary = search1?.primaryContents as AnyObj | undefined;
  const sectionList = primary?.sectionListRenderer as AnyObj | undefined;
  if (Array.isArray(sectionList?.contents)) mainFeedRoots.push(sectionList!.contents);

  // If we found at least one focused root, walk only those. Otherwise fall
  // back to the whole tree (defensive — handles unknown shapes).
  if (mainFeedRoots.length > 0) {
    for (const r of mainFeedRoots) walkInScope(r);
  } else {
    walkInScope(json);
  }
  walkMetaOnly(json);

  return { videos: out, shorts: shortsOut, continuation: nextToken, chips: chipsOut };
}

import { getCachedHomeFeed, setCachedHomeFeed } from './cache';

export async function getHomeFeed(): Promise<HomeFeedResult> {
  // Server-side 10-min cache. All visitors share the same entry (the underlying
  // YouTube cookies belong to the server's machine, not the visitor cookie),
  // so this is safe and makes reloads near-instant.
  const cached = getCachedHomeFeed();
  if (cached) return cached;
  const fresh = await fetchHomeFeedUncached();
  setCachedHomeFeed(fresh);
  return fresh;
}

async function fetchHomeFeedUncached(): Promise<HomeFeedResult> {
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', reason: 'innertube session unavailable' };
  }
  if (!session.authenticated) {
    // Personalized home feed needs login — anonymous /browse FEwhat_to_watch
    // returns a generic trending feed, not "your" feed. Bail so the adapter
    // selector falls back to the mock catalog on Vercel.
    return { kind: 'unavailable', reason: 'home feed requires authentication' };
  }
  const innertube = session.instance;

  let raw: unknown;
  try {
    const resp = await innertube.actions.execute('/browse', {
      browseId: 'FEwhat_to_watch',
    });
    // youtubei.js wraps the response — `.data` is the raw JSON we want.
    raw = (resp as { data?: unknown })?.data ?? resp;
  } catch (err) {
    return {
      kind: 'unavailable',
      reason: `actions.execute /browse failed: ${(err as Error).message}`,
    };
  }

  const initial = extractLockupVideos(raw);
  const videos = [...initial.videos];
  const shorts = [...initial.shorts];

  // One continuation pass, also via raw API, if we have headroom on videos.
  // Shorts only appear in the initial response (they're in a fixed shelf,
  // not the lazy-loaded continuation).
  let token = initial.continuation;
  if (videos.length < 30 && typeof token === 'string' && token.length > 0) {
    try {
      const resp2 = await innertube.actions.execute('/browse', { token });
      const raw2 = (resp2 as { data?: unknown })?.data ?? resp2;
      const more = extractLockupVideos(raw2);
      const seen = new Set(videos.map((v) => v.id));
      for (const v of more.videos) {
        if (!seen.has(v.id)) videos.push(v);
      }
    } catch (err) {
      console.warn(`[innertube] continuation failed: ${(err as Error).message}`);
    }
  }

  if (videos.length === 0) {
    return {
      kind: 'unavailable',
      reason: 'home feed parsed empty (cookie expired?)',
    };
  }

  console.log(`[innertube] home feed: ${videos.length} videos, ${shorts.length} shorts, ${initial.chips.length} chips`);
  return { kind: 'ok', videos, shorts, continuation: token ?? null, chips: initial.chips };
}

// ---------- Dynamic API: continuation, browse-by-id, search ----------

export interface DynamicResult {
  kind: 'ok' | 'unavailable';
  videos: Video[];
  shorts: Short[];
  continuation: string | null;
  chips?: YtChip[];
  reason?: string;
}

// Fetches the next page of videos given a continuation token. Used by the
// VideoGrid's IntersectionObserver for infinite scroll.
export async function getMoreVideos(token: string): Promise<DynamicResult> {
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: 'innertube session unavailable' };
  }
  const innertube = session.instance;
  try {
    const resp = await innertube.actions.execute('/browse', { token });
    const raw = (resp as { data?: unknown })?.data ?? resp;
    const out = extractLockupVideos(raw);
    return { kind: 'ok', videos: out.videos, shorts: out.shorts, continuation: out.continuation };
  } catch (err) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: (err as Error).message };
  }
}

// Real YouTube chips currently expose a continuation token (not a browse
// `params` field). The chat / chip-click pipeline sends the token through
// the `params` argument of this function for backwards-compatibility; we
// detect which kind of token it is and route accordingly:
//   - Continuation tokens (chipCloudChipRenderer.continuationCommand.token)
//     start with the magic prefix '4qmFs' on YouTube web → send as
//     `continuation` so the API returns onResponseReceivedActions.
//   - Legacy browse params get sent as `params` (kept for safety; legacy is
//     defensive — YouTube may resurrect this path).
export async function getBrowse(browseId: string, params?: string): Promise<DynamicResult> {
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: 'innertube session unavailable' };
  }
  const innertube = session.instance;
  try {
    const body: Record<string, unknown> = {};
    if (typeof params === 'string' && params.length > 0) {
      // Continuation tokens are long base64; browse params are shorter and
      // often base64-ish too. The reliable signal is the magic prefix:
      // continuation tokens for YouTube web start with '4qmFs'. If we can't
      // tell, prefer continuation (that's what current chips emit).
      const looksLikeContinuation = params.startsWith('4qmFs') || params.length > 200;
      if (looksLikeContinuation) {
        body['continuation'] = params;
      } else {
        body['browseId'] = browseId;
        body['params'] = params;
      }
    } else {
      body['browseId'] = browseId;
    }
    const resp = await innertube.actions.execute('/browse', body);
    const raw = (resp as { data?: unknown })?.data ?? resp;
    const out = extractLockupVideos(raw);
    return {
      kind: 'ok',
      videos: out.videos,
      shorts: out.shorts,
      continuation: out.continuation,
      chips: out.chips,
    };
  } catch (err) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: (err as Error).message };
  }
}

// Search runs against the user's logged-in account so personalized suggestions
// surface. Same lockup walker handles the response shape.
export async function searchVideos(query: string): Promise<DynamicResult> {
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: 'innertube session unavailable' };
  }
  const innertube = session.instance;
  try {
    const resp = await innertube.actions.execute('/search', { query });
    const raw = (resp as { data?: unknown })?.data ?? resp;
    const out = extractLockupVideos(raw);
    return { kind: 'ok', videos: out.videos, shorts: out.shorts, continuation: out.continuation };
  } catch (err) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: (err as Error).message };
  }
}

// Subscriptions feed — only available with a logged-in session. Uses the
// stable browseId 'FEsubscriptions'. Falls through to unavailable when the
// Innertube session is anonymous (no cookies).
export async function getSubscriptionsFeed(): Promise<DynamicResult> {
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: 'innertube session unavailable' };
  }
  if (!session.authenticated) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: 'subscriptions require authentication' };
  }
  const innertube = session.instance;
  try {
    const resp = await innertube.actions.execute('/browse', { browseId: 'FEsubscriptions' });
    const raw = (resp as { data?: unknown })?.data ?? resp;
    const out = extractLockupVideos(raw);
    return { kind: 'ok', videos: out.videos, shorts: out.shorts, continuation: out.continuation };
  } catch (err) {
    return { kind: 'unavailable', videos: [], shorts: [], continuation: null, reason: (err as Error).message };
  }
}

// ---------- Comments ----------

export interface YtComment {
  id: string;
  author: string;
  authorAvatar: string;
  authorVerified: boolean;
  text: string;
  postedAgo: string;
  likes: string;
  replyCount: string;
  isPinned: boolean;
  isCreator: boolean;
}

export interface CommentsOk {
  kind: 'ok';
  comments: YtComment[];
  total: string | null;
}

export type CommentsResult = CommentsOk | HomeFeedUnavailable;

function pickThumbnailUrl(thumbs: { url?: string; width?: number }[] | undefined): string {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return '';
  let bestUrl = '';
  let bestWidth = -1;
  for (const t of thumbs) {
    if (typeof t.url !== 'string') continue;
    const w = typeof t.width === 'number' ? t.width : 0;
    if (w >= bestWidth) {
      bestUrl = t.url;
      bestWidth = w;
    }
  }
  return bestUrl;
}

// Fetches the top comments for a video via youtubei.js's high-level
// getComments() helper. Returns a flat array — replies are not expanded
// in v1 (the WatchPage UI only shows top-level threads for now).
export async function getVideoComments(videoId: string): Promise<CommentsResult> {
  if (typeof videoId !== 'string' || videoId.length === 0) {
    return { kind: 'unavailable', reason: 'invalid videoId' };
  }
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', reason: 'innertube session unavailable' };
  }
  const innertube = session.instance;
  try {
    const result = await innertube.getComments(videoId, 'TOP_COMMENTS');
    const total = typeof (result as { header?: { comments_count?: { text?: string } } }).header?.comments_count?.text === 'string'
      ? (result as { header?: { comments_count?: { text?: string } } }).header!.comments_count!.text!
      : null;
    const threads = Array.isArray(result.contents) ? result.contents : [];
    const out: YtComment[] = [];
    for (const thread of threads) {
      const c = thread.comment;
      if (!c) continue;
      const author = c.author?.name ?? '';
      if (author.length === 0) continue;
      const text = tryToString(c.content);
      if (text.length === 0) continue;
      const authorAvatar =
        pickThumbnailUrl(c.author?.thumbnails as { url?: string; width?: number }[] | undefined) ||
        (typeof c.creator_thumbnail_url === 'string' ? c.creator_thumbnail_url : '');
      out.push({
        id: c.comment_id,
        author,
        authorAvatar,
        authorVerified: (c.author as { is_verified?: boolean } | undefined)?.is_verified === true,
        text,
        postedAgo: typeof c.published_time === 'string' ? c.published_time : '',
        likes: typeof c.like_count === 'string' ? c.like_count : '',
        replyCount: typeof c.reply_count === 'string' ? c.reply_count : '',
        isPinned: c.is_pinned === true,
        isCreator: c.author_is_channel_owner === true,
      });
    }
    return { kind: 'ok', comments: out, total };
  } catch (err) {
    return { kind: 'unavailable', reason: `getComments failed: ${(err as Error).message}` };
  }
}

// ---------- Per-video info (description, subs, views, likes) ----------

export interface YtVideoInfo {
  title: string;
  description: string;
  viewCount: number;
  likeCount: number;
  postedAgo: string;
  channel: {
    name: string;
    avatar: string;
    verified: boolean;
    subscriberCount: number;
    subscriberCountText: string;
  };
}

export type VideoInfoResult = { kind: 'ok'; info: YtVideoInfo } | HomeFeedUnavailable;

// Parses "1.2M subscribers" / "1,234 subscribers" / "No subscribers" into a
// rough integer. Strips the trailing "subscribers" word so parseViewCount can
// reuse its K/M/B suffix logic.
function parseSubscriberCount(text: string | undefined): number {
  if (typeof text !== 'string') return 0;
  const t = text.replace(/subscribers?/i, '').trim();
  if (t.length === 0) return 0;
  return parseViewCount(t);
}

export async function getVideoInfo(videoId: string): Promise<VideoInfoResult> {
  if (typeof videoId !== 'string' || videoId.length === 0) {
    return { kind: 'unavailable', reason: 'invalid videoId' };
  }
  const session = await createInnertube();
  if (session === null) {
    return { kind: 'unavailable', reason: 'innertube session unavailable' };
  }
  const innertube = session.instance;
  try {
    const info = await innertube.getInfo(videoId);
    const basic = info.basic_info;
    const secondary = info.secondary_info;
    const owner = secondary?.owner ?? null;
    const author = owner?.author;

    const subscriberCountText = tryToString(owner?.subscriber_count);
    const description =
      tryToString(secondary?.description) ||
      (typeof basic.short_description === 'string' ? basic.short_description : '');

    const channelName =
      (typeof author?.name === 'string' ? author.name : '') ||
      basic.channel?.name ||
      '';
    const channelAvatar = pickThumbnailUrl(
      author?.thumbnails as { url?: string; width?: number }[] | undefined,
    );
    const channelVerified =
      (author as { is_verified?: boolean } | undefined)?.is_verified === true;

    // postedAgo lives on primary_info.published / .relative_date — fall back
    // to whichever surface is non-empty.
    const primary = info.primary_info as
      | { published?: unknown; relative_date?: unknown }
      | undefined;
    const postedAgo =
      tryToString(primary?.relative_date) ||
      tryToString(primary?.published) ||
      '';

    return {
      kind: 'ok',
      info: {
        title: typeof basic.title === 'string' ? basic.title : '',
        description,
        viewCount: typeof basic.view_count === 'number' ? basic.view_count : 0,
        likeCount: typeof basic.like_count === 'number' ? basic.like_count : 0,
        postedAgo,
        channel: {
          name: channelName,
          avatar: channelAvatar,
          verified: channelVerified,
          subscriberCount: parseSubscriberCount(subscriberCountText),
          subscriberCountText,
        },
      },
    };
  } catch (err) {
    return { kind: 'unavailable', reason: `getInfo failed: ${(err as Error).message}` };
  }
}

// Test-only: re-export cookie helpers so callers can introspect.
export type { Cookie };
