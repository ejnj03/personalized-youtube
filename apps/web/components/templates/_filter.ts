import type { PageConfig, Video } from '@showcase/shared';

/**
 * Word-boundary fuzzy match: `'photography'` matches a tag of `'underwater photography'`
 * (because the tag splits into `['underwater', 'photography']`).
 * This makes filters resilient to compound tags Claude tends to emit.
 */
function tagMatches(filterTag: string, videoTags: string[]): boolean {
  const f = filterTag.toLowerCase().trim();
  if (!f) return true;
  return videoTags.some((vt) => {
    const v = vt.toLowerCase().trim();
    if (v === f) return true;
    if (v.includes(f) || f.includes(v)) return true;
    const words = v.split(/[\s\-_/,]+/);
    return words.includes(f);
  });
}

function channelMatches(filterChannel: string, videoChannel: string): boolean {
  return filterChannel.toLowerCase().trim() === videoChannel.toLowerCase().trim()
    || videoChannel.toLowerCase().includes(filterChannel.toLowerCase().trim());
}

// Unicode script ranges for title-language heuristic. We don't try to detect
// every language — just the ones with distinctive non-overlapping scripts.
const LANG_SCRIPTS: Record<string, RegExp> = {
  en: /[A-Za-z]/g,
  ko: /[가-힯ᄀ-ᇿ㄰-㆏]/g,
  ja: /[぀-ゟ゠-ヿ]/g,
  zh: /[一-鿿]/g,
  ar: /[؀-ۿ]/g,
  ru: /[Ѐ-ӿ]/g,
};

// Score: what fraction of `text`'s non-punctuation chars are in `pattern`.
function scriptShare(text: string, pattern: RegExp): number {
  const stripped = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (stripped.length === 0) return 0;
  const matches = stripped.match(pattern) ?? [];
  return matches.length / stripped.length;
}

// Keep a video when EITHER its title OR its channel name is at least ~25%
// the target script. The OR catches international creators who title in
// their native script but have English channel names (e.g. "Asian Boss",
// "NHK World") — those typically ship English audio or captions, so
// dropping them is more wrong than letting them through. Caveat: we can't
// see actual caption-track languages from the home/search feed shape —
// that would require a per-video transcript fetch. This stays a heuristic.
function passLanguageFilter(title: string, channelName: string, requiredLang: string): boolean {
  const pattern = LANG_SCRIPTS[requiredLang];
  if (!pattern) return true;
  return scriptShare(title, pattern) > 0.25 || scriptShare(channelName, pattern) > 0.25;
}

// '/regex/flags' → RegExp match; otherwise case-insensitive substring.
function titleMatchesPattern(title: string, pattern: string): boolean {
  if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
    const lastSlash = pattern.lastIndexOf('/');
    const body = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1) || 'i';
    try {
      return new RegExp(body, flags).test(title);
    } catch {
      return false;
    }
  }
  return title.toLowerCase().includes(pattern.toLowerCase());
}

// YouTube's duration field is 'LIVE'/'PREMIERE'/'UPCOMING'/'WAITING' for
// non-finalized streams; otherwise a HH:MM:SS or MM:SS clip length.
function isLiveDuration(duration: string): boolean {
  return /live|premiere|upcoming|waiting/i.test(duration);
}

export function applyFeedFilter(videos: Video[], config: PageConfig): Video[] {
  const { filter, sort } = config;
  let out = videos;

  if (filter.requireTags.length > 0) {
    out = out.filter((v) => filter.requireTags.every((t) => tagMatches(t, v.tags)));
  }
  if (filter.exclude.length > 0) {
    out = out.filter((v) => !filter.exclude.some((t) => tagMatches(t, v.tags)));
  }
  if (filter.blockChannels.length > 0) {
    out = out.filter((v) => !filter.blockChannels.some((c) => channelMatches(c, v.channel.name)));
  }
  if (filter.include.length > 0) {
    out = out.filter(
      (v) => filter.include.some((t) => tagMatches(t, v.tags) || v.category === t),
    );
  }
  if (filter.minDurationSeconds || filter.maxDurationSeconds) {
    out = out.filter((v) => {
      const secs = parseDuration(v.duration);
      if (filter.minDurationSeconds && secs < filter.minDurationSeconds) return false;
      if (filter.maxDurationSeconds && secs > filter.maxDurationSeconds) return false;
      return true;
    });
  }
  if (filter.minSubscriberCount || filter.maxSubscriberCount) {
    out = out.filter((v) => {
      const subs = v.channel.subscriberCount;
      // Missing data shouldn't read as "fails the threshold". YouTube's
      // /search responses commonly omit subscriber counts; treating undefined
      // as 0 would silently drop every search result against any positive
      // minSubscriberCount. Pass-through on unknown is the safer default.
      if (typeof subs !== 'number') return true;
      if (filter.minSubscriberCount && subs < filter.minSubscriberCount) return false;
      if (filter.maxSubscriberCount && subs > filter.maxSubscriberCount) return false;
      return true;
    });
  }
  // hideWatched drops seen videos entirely. showWatchedOverlay (handled in
  // VideoCard) just dims them — they stay in the feed.
  if (filter.hideWatched) {
    out = out.filter((v) => v.watched !== true);
  }
  // moodFilter scopes to a specific mood id (if Video.mood is set) OR videos
  // whose tags overlap with the mood definition. We do a soft check here.
  if (filter.moodFilter) {
    const m = filter.moodFilter.toLowerCase();
    out = out.filter((v) => {
      if (typeof v.mood === 'string' && v.mood.toLowerCase() === m) return true;
      return v.tags.some((t) => t.toLowerCase() === m);
    });
  }
  if (typeof filter.requireLanguage === 'string' && filter.requireLanguage.length > 0) {
    const lang = filter.requireLanguage;
    out = out.filter((v) => passLanguageFilter(v.title, v.channel.name, lang));
  }
  if (filter.allowChannels.length > 0) {
    out = out.filter((v) =>
      filter.allowChannels.some((c) => channelMatches(c, v.channel.name)),
    );
  }
  if (filter.requireTitleMatches.length > 0) {
    out = out.filter((v) =>
      filter.requireTitleMatches.some((p) => titleMatchesPattern(v.title, p)),
    );
  }
  if (filter.excludeTitleMatches.length > 0) {
    out = out.filter(
      (v) => !filter.excludeTitleMatches.some((p) => titleMatchesPattern(v.title, p)),
    );
  }
  if (filter.hideLive) {
    out = out.filter((v) => !isLiveDuration(v.duration));
  }
  if (filter.onlyLive) {
    out = out.filter((v) => isLiveDuration(v.duration));
  }

  switch (sort.by) {
    case 'recent':
      out = [...out].reverse();
      break;
    case 'popular':
      out = [...out].sort((a, b) => (sort.order === 'asc' ? a.views - b.views : b.views - a.views));
      break;
    case 'duration':
      out = [...out].sort((a, b) => {
        const da = parseDuration(a.duration);
        const db = parseDuration(b.duration);
        return sort.order === 'asc' ? da - db : db - da;
      });
      break;
    case 'density': {
      // Topical-density score: (unique_tags / runtime_minutes) so a 45-min
      // single-topic deep-dive beats a 4-min trending clip with five tags.
      const score = (v: Video): number => {
        if (typeof v.density === 'number' && v.density > 0) return v.density;
        const minutes = Math.max(1, parseDuration(v.duration) / 60);
        const uniqueTags = new Set(v.tags.map((t) => t.toLowerCase())).size;
        return uniqueTags === 0 ? Math.log1p(minutes) : (uniqueTags + Math.log1p(minutes)) / Math.max(1, uniqueTags);
      };
      out = [...out].sort((a, b) => (sort.order === 'asc' ? score(a) - score(b) : score(b) - score(a)));
      // Honor `secondary: 'duration'` when ties matter (rare but real).
      if (sort.secondary === 'duration') {
        out.sort((a, b) => parseDuration(b.duration) - parseDuration(a.duration));
      }
      break;
    }
    case 'mood': {
      // Group by Video.mood; respects sort.moodOrder when present.
      const order = sort.moodOrder ?? [];
      const idx = (v: Video): number => {
        if (!v.mood) return Number.MAX_SAFE_INTEGER;
        const i = order.indexOf(v.mood);
        return i === -1 ? order.length : i;
      };
      out = [...out].sort((a, b) => idx(a) - idx(b));
      break;
    }
  }

  return out;
}

function parseDuration(s: string): number {
  const parts = s.split(':').map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return 0;
}
