import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { applyPatches, createChatHandler } from '@showcase/sdk';
import { translateCuesTokenized } from '@showcase/sdk/core';
import { host } from './host';
import { searchVideos, getStreamUrl } from './innertube';

// Safety net: youtubei.js can throw async during signature/cipher work
// (signature challenges, PoToken rollouts). Without this, an unhandled
// rejection takes down the whole server, breaking lyrics + modes + chat
// alongside the video lookup.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});

const app = new Hono();

// Allow the CRA dev server (port 3001) to call this backend (port 8787).
// Both run locally on different ports, so CORS is always in play — there is
// no deployed single-origin setup that makes it a no-op.
app.use('/api/*', cors({
  // Spotify CRA dev server runs on 3001 (3000 is taken by the YT clone).
  // Browser treats localhost vs 127.0.0.1 as distinct origins → allow both.
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));

// The SDK's chat handler is a Web Standard (Request → Response). Hono's
// c.req.raw is the Request and `return` accepts the Response — clean fit.
const chatHandler = createChatHandler(host);
app.post('/api/chat', (c) => chatHandler(c.req.raw));

// ─── Modes (parallel save-slots) ────────────────────────────────────────
// List modes the visitor has at this slug.
app.get('/api/modes', async (c) => {
  const slug = c.req.query('slug') ?? 'spotify';
  const visitorId = c.req.query('visitorId');
  if (!visitorId) return c.json({ modes: [] });
  const modes = await host.persistence.listModes(visitorId, slug);
  return c.json({ modes });
});

// Create a new mode for the visitor at this slug.
app.post('/api/modes', async (c) => {
  type CreateBody = { slug?: string; visitorId?: string; title?: string };
  const body: CreateBody = await c.req.json<CreateBody>().catch(() => ({} as CreateBody));
  const slug = body.slug ?? 'spotify';
  if (!body.visitorId || !body.title) {
    return c.json({ error: 'visitorId and title required' }, 400);
  }
  try {
    const mode = await host.persistence.createMode(body.visitorId, slug, body.title);
    return c.json({ mode });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Return the visitor's merged page config for a specific mode (base +
// their patches in that mode). Spotify is a CRA SPA so it can't SSR-render
// the personalized state like YT does; the app and chat panel both fetch
// this when loading or switching modes.
app.get('/api/page', async (c) => {
  const slug = c.req.query('slug') ?? 'spotify';
  const visitorId = c.req.query('visitorId');
  const modeId = c.req.query('modeId');
  if (!visitorId || !modeId) return c.json({ config: host.initialConfig });
  const patches = await host.persistence.read(visitorId, slug, modeId);
  const config = applyPatches(host.initialConfig, patches);
  return c.json({ config });
});

// Hydrate chat transcript for a specific mode. The chat panel fetches this
// on mount and on every mode switch to repopulate the visible transcript.
// ─── Lyrics (LRClib) ───────────────────────────────────────────────────
// Fetch synced + plain lyrics for a track from lrclib.net. Returns:
//   { synced: [{t: number_seconds, line: string}], plain: string }
// LRClib's /api/get takes artist_name + track_name (+ optional duration for
// disambiguation). syncedLyrics is the LRC string ("[mm:ss.xx] line"); plain
// is the unsynced fallback.
function parseLrc(raw: string): Array<{ t: number; line: string }> {
  const out: Array<{ t: number; line: string }> = [];
  for (const row of raw.split(/\r?\n/)) {
    const m = row.match(/^\[(\d+):(\d+)(?:\.(\d+))?\](.*)$/);
    if (!m) continue;
    const min = parseInt(m[1]!, 10);
    const sec = parseInt(m[2]!, 10);
    const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
    out.push({ t: min * 60 + sec + frac, line: m[4]!.trim() });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Strip parenthetical/bracketed annotations + common version suffixes that
// LRClib's exact-match /api/get won't recognize. Examples removed:
//   "Ditto (SIDE A)" → "Ditto"
//   "Red (Taylor's Version)" → "Red"
//   "Hello - Remastered 2015" → "Hello"
//   "Track Name (feat. Someone)" → "Track Name"
function cleanTrackName(raw: string): string {
  return raw
    .replace(/\s*[([][^)\]]*[)\]]\s*$/g, '')           // trailing (...) or [...]
    .replace(/\s*-\s*(remaster(ed)?|live|acoustic|deluxe|mono|stereo).*$/i, '')
    .trim();
}

type LrcResult = { syncedLyrics?: string; plainLyrics?: string };

async function fetchLyricsStrict(artist: string, track: string, duration?: string): Promise<LrcResult | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: track });
  if (duration) params.set('duration', duration);
  const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
    headers: { 'User-Agent': 'showcase-spotify-clone (https://github.com/local)' },
  });
  if (!res.ok) return null;
  return (await res.json()) as LrcResult;
}

async function fetchLyricsSearch(artist: string, track: string): Promise<LrcResult | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: track });
  const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
    headers: { 'User-Agent': 'showcase-spotify-clone (https://github.com/local)' },
  });
  if (!res.ok) return null;
  const list = (await res.json()) as Array<LrcResult>;
  // Prefer the first result that has synced lyrics; else first with plain.
  const synced = list.find((r) => r.syncedLyrics);
  if (synced) return synced;
  const plain = list.find((r) => r.plainLyrics);
  return plain ?? list[0] ?? null;
}

// ─── Music video lookup (YouTube search) ───────────────────────────────
// Scrape YouTube's search results HTML and return the first videoId.
// No API key needed. The frontend embeds via <iframe>.
// Music-video lookup via youtubei.js (anonymous mode, no Chrome cookies).
// Searches "{artist} {track} official music video", walks candidates in
// relevance order and returns the first one that resolves to a muxed
// stream URL. Native <video> bypasses the IFrame embed entirely.
//
// Two-layer in-memory cache:
//  - (artist|track) → videoId — "what's the canonical MV for this track"
//    Stable for the lifetime of the process; the official MV doesn't
//    change. TTL is mostly a safety valve.
//  - videoId → streamUrl + expiresAt — signed URLs expire in ~6h. We
//    refetch on miss or 90% of TTL elapsed.
interface MvIdCacheEntry { videoId: string | null; ts: number; }
interface MvStreamCacheEntry { streamUrl: string; expiresAt: number; }
const MV_ID_TTL_MS = 24 * 60 * 60 * 1000;          // 24h
const MV_STREAM_TTL_MS = 5 * 60 * 60 * 1000;       // 5h (signed URL is ~6h)
const mvIdCache = new Map<string, MvIdCacheEntry>();
const mvStreamCache = new Map<string, MvStreamCacheEntry>();

function mvKey(artist: string, track: string): string {
  return `${artist.toLowerCase().trim()}|${track.toLowerCase().trim()}`;
}

app.get('/api/music-video', async (c) => {
  const artist = c.req.query('artist');
  const track = c.req.query('track');
  if (!artist || !track) {
    return c.json({ error: 'artist and track required' }, 400);
  }
  const now = Date.now();
  const key = mvKey(artist, track);

  // Layer 1: do we know which videoId this track maps to?
  let resolvedId: string | null | undefined;
  const idHit = mvIdCache.get(key);
  if (idHit && now - idHit.ts < MV_ID_TTL_MS) {
    resolvedId = idHit.videoId;
    if (resolvedId === null) {
      // Negative cache — we know there's no MV; don't re-search.
      return c.json({ videoId: null, streamUrl: null, found: false, cached: true });
    }
  }

  // Layer 2: if we have a videoId, do we still have a non-expired stream?
  if (resolvedId) {
    const streamHit = mvStreamCache.get(resolvedId);
    if (streamHit && streamHit.expiresAt > now) {
      return c.json({
        videoId: resolvedId,
        streamUrl: streamHit.streamUrl,
        found: true,
        cached: true,
      });
    }
    // Stream cache miss/expired — refresh the stream for the known id.
    const fresh = await getStreamUrl(resolvedId);
    if (fresh) {
      mvStreamCache.set(resolvedId, { streamUrl: fresh, expiresAt: now + MV_STREAM_TTL_MS });
      return c.json({ videoId: resolvedId, streamUrl: fresh, found: true });
    }
    // Known id but stream re-resolve failed — fall through to full search
    // (the id may now be embed-removed; try a fresh candidate).
  }

  const cleaned = track.replace(/\s*[([][^)\]]*[)\]]\s*$/g, '').trim();
  const query = `${artist} ${cleaned} official music video`;
  try {
    const candidates = await searchVideos(query, 6);
    if (candidates.length === 0) {
      mvIdCache.set(key, { videoId: null, ts: now });
      return c.json({ videoId: null, streamUrl: null, found: false });
    }
    for (const v of candidates) {
      const streamUrl = await getStreamUrl(v.id);
      if (streamUrl) {
        mvIdCache.set(key, { videoId: v.id, ts: now });
        mvStreamCache.set(v.id, { streamUrl, expiresAt: now + MV_STREAM_TTL_MS });
        return c.json({
          videoId: v.id,
          title: v.title,
          channel: v.channel,
          streamUrl,
          found: true,
        });
      }
    }
    // No candidate yielded a stream — negative-cache by track key.
    mvIdCache.set(key, { videoId: null, ts: now });
    return c.json({ videoId: candidates[0]!.id, streamUrl: null, found: false });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Lyrics cache — synced LRC strings don't change; cache aggressively.
interface LyricsCacheEntry { body: unknown; ts: number; }
const LYRICS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const lyricsCache = new Map<string, LyricsCacheEntry>();

interface LyricsBody { synced: Array<{ t: number; line: string }>; plain: string; found: boolean }

// Shared fetch + cache for a track's lyrics. Used by /api/lyrics and the
// translation endpoint (so a translation reuses the already-fetched lyrics).
async function getLyrics(artist: string, track: string, duration?: string): Promise<LyricsBody> {
  const now = Date.now();
  const cacheKey = `${artist.toLowerCase().trim()}|${track.toLowerCase().trim()}`;
  const hit = lyricsCache.get(cacheKey);
  if (hit && now - hit.ts < LYRICS_TTL_MS) return hit.body as LyricsBody;

  const cleaned = cleanTrackName(track);
  // 1) exact match → 2) cleaned name → 3) fuzzy search.
  let data: LrcResult | null = await fetchLyricsStrict(artist, track, duration);
  if ((!data?.syncedLyrics && !data?.plainLyrics) && cleaned !== track) {
    data = await fetchLyricsStrict(artist, cleaned, duration);
  }
  if (!data?.syncedLyrics && !data?.plainLyrics) {
    data = await fetchLyricsSearch(artist, cleaned);
  }
  const synced = data?.syncedLyrics ? parseLrc(data.syncedLyrics) : [];
  const body: LyricsBody = { synced, plain: data?.plainLyrics ?? '', found: synced.length > 0 || !!data?.plainLyrics };
  lyricsCache.set(cacheKey, { body, ts: now });
  return body;
}

app.get('/api/lyrics', async (c) => {
  const artist = c.req.query('artist');
  const track = c.req.query('track');
  const duration = c.req.query('duration');
  if (!artist || !track) {
    return c.json({ error: 'artist and track required' }, 400);
  }
  try {
    return c.json(await getLyrics(artist, track, duration));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Translated lyrics — merge-translate each synced line into `lang`, marking
// (for color-coding) which segments were ALREADY in the target language
// (multilingual K-pop etc.). Cached per (track, lang) — translations are
// deterministic for a given line set.
const lyricsTransCache = new Map<string, LyricsCacheEntry>();

app.get('/api/lyrics/translate', async (c) => {
  const artist = c.req.query('artist');
  const track = c.req.query('track');
  const lang = (c.req.query('lang') ?? '').trim();
  const duration = c.req.query('duration');
  if (!artist || !track || !lang) {
    return c.json({ error: 'artist, track and lang required' }, 400);
  }
  const now = Date.now();
  const key = `${artist.toLowerCase().trim()}|${track.toLowerCase().trim()}|${lang}`;
  const hit = lyricsTransCache.get(key);
  if (hit && now - hit.ts < LYRICS_TTL_MS) {
    return c.json(hit.body as Record<string, unknown>);
  }
  try {
    const lyrics = await getLyrics(artist, track, duration);
    if (lyrics.synced.length === 0) {
      return c.json({ synced: [], lang, found: false });
    }
    const cues = lyrics.synced.map((l) => ({ start: l.t, text: l.line }));
    const translated = await translateCuesTokenized(cues, lang, {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
    const synced = lyrics.synced.map((l, i) => ({
      t: l.t,
      line: l.line,
      tokens: translated[i]?.tokens ?? [{ text: l.line, fromTarget: false }],
    }));
    const body = { synced, lang, found: true };
    lyricsTransCache.set(key, { body, ts: now });
    return c.json(body);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Wipe all patches for a (visitor, mode) and log the reset as a chat turn
// so it appears in transcript history on reload.
app.post('/api/reset', async (c) => {
  type ResetBody = { slug?: string; visitorId?: string; modeId?: string };
  const body: ResetBody = await c.req.json<ResetBody>().catch(() => ({} as ResetBody));
  const slug = body.slug ?? 'spotify';
  if (!body.visitorId || !body.modeId) {
    return c.json({ error: 'visitorId and modeId required' }, 400);
  }
  try {
    await host.persistence.reset(body.visitorId, slug, body.modeId);
    await host.persistence.recordTurn(body.visitorId, slug, body.modeId, {
      userMessage: '',
      assistantMessage: 'Preferences reset.',
      toolUses: [],
      createdAt: new Date().toISOString(),
    });
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get('/api/chat/history', async (c) => {
  const slug = c.req.query('slug') ?? 'spotify';
  const limit = Math.min(parseInt(c.req.query('limit') ?? '30', 10) || 30, 100);
  const visitorId = c.req.query('visitorId');
  const modeId = c.req.query('modeId');
  if (!visitorId || !modeId) return c.json({ messages: [] });

  const turns = await host.persistence.readTurns(visitorId, slug, modeId, limit);

  const messages: Array<{ role: 'user' | 'assistant'; content: string; toolUses?: Array<{ name: string }> }> = [];
  for (const t of turns) {
    if (t.userMessage) messages.push({ role: 'user', content: t.userMessage });
    if (t.assistantMessage || t.toolUses.length > 0) {
      messages.push({
        role: 'assistant',
        content: t.assistantMessage,
        ...(t.toolUses.length > 0 ? { toolUses: t.toolUses } : {}),
      });
    }
  }
  return c.json({ messages });
});

const port = 8787;
serve({ fetch: app.fetch, port });
console.log(`spotify chat backend listening on http://localhost:${port}`);
