// Anonymous-mode innertube wrapper for music-video search + stream URL
// resolution. Uses bgutils-js + jsdom to generate a BotGuard PoToken so
// stream extraction works for the ~95% of videos YouTube now gates behind
// PoToken challenges. Without it, every chooseFormat().decipher() returns
// "No valid URL to decipher".
//
// NOTE: This is the heavier "do it properly" path for spotify's MV view.
// The YT clone in apps/web stays on plain anonymous innertube — it only
// needs metadata (search, comments, channel browse), not stream URLs.

import { Innertube, Platform, UniversalCache } from 'youtubei.js';
import { BG } from 'bgutils-js';
import { JSDOM } from 'jsdom';
import vm from 'node:vm';

// v17 dropped the built-in JS evaluator on every platform (the bundled
// node.js platform shim still uses ./jsruntime/default which throws). To
// decipher signature_cipher / n-param functions YouTube serves as
// obfuscated JS, we override Platform.shim.eval with a node:vm sandbox.
// data.output is the script to run; eval_args are injected as variables.
{
  const current = Platform.shim;
  Platform.load({
    ...current,
    eval: (data: { output: string }, env: Record<string, unknown>) => {
      // The player script uses top-level `return` to surface its result —
      // vm.runInNewContext rejects that as "Illegal return statement".
      // Wrap in an IIFE so the returns are legal and the IIFE's value
      // bubbles out as the script's last expression.
      const wrapped = `(function(){\n${data.output}\n})()`;
      return vm.runInNewContext(wrapped, { ...env });
    },
  });
}

interface CacheEntry {
  instance: Innertube;
  poToken: string;
  visitorData: string;
  createdAt: number;
}

// PoTokens are session-scoped; they don't expire as fast as deciphered URLs.
// 6h is conservative — bgutils-js maintainers cite ~24h validity in practice.
const TTL_MS = 6 * 60 * 60 * 1000;
let cached: CacheEntry | null = null;

async function generatePoToken(visitorData: string): Promise<string> {
  // Spin up a minimal jsdom so BG's BotGuard interpreter has window/document.
  // Scoped to this function so global pollution lasts only during gen.
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://www.youtube.com/',
  });
  const priorWindow = (globalThis as any).window;
  const priorDocument = (globalThis as any).document;
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;

  try {
    const requestKey = 'O43z0dpjhgX20SCx4KAo'; // public key used by youtubei.js examples
    const bgConfig = {
      fetch: (url: any, options: any) => fetch(url, options),
      globalObj: globalThis,
      identifier: visitorData,
      requestKey,
    };

    const bgChallenge = await BG.Challenge.create(bgConfig);
    if (!bgChallenge) throw new Error('BG.Challenge.create returned null');

    const interpreterJs = bgChallenge.interpreterJavascript
      .privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (interpreterJs) {
      // eslint-disable-next-line no-new-func
      new Function(interpreterJs)();
    } else {
      throw new Error('Missing BG interpreter JavaScript');
    }

    const poTokenResult = await BG.PoToken.generate({
      program: bgChallenge.program,
      globalName: bgChallenge.globalName,
      bgConfig,
    });
    if (!poTokenResult?.poToken) throw new Error('PoToken.generate returned empty');
    return poTokenResult.poToken;
  } finally {
    // Restore globals so we don't leak window/document into other server code.
    (globalThis as any).window = priorWindow;
    (globalThis as any).document = priorDocument;
  }
}

export async function getInnertube(): Promise<Innertube> {
  const now = Date.now();
  if (cached && now - cached.createdAt < TTL_MS) return cached.instance;

  // Step 1: anonymous innertube just to get a visitor_data string.
  const tmp = await Innertube.create({
    retrieve_player: false,
    generate_session_locally: true,
    cache: new UniversalCache(false),
  });
  const visitorData = tmp.session.context.client.visitorData;
  if (!visitorData) throw new Error('Could not obtain visitor_data');

  // Step 2: run BotGuard challenge → PoToken.
  console.log('[innertube] generating PoToken…');
  const poToken = await generatePoToken(visitorData);
  console.log(`[innertube] PoToken acquired (len=${poToken.length})`);

  // Step 3: real innertube with PoToken + visitor_data. Now stream URLs
  // come back with valid signatureCipher / n-params we can decipher.
  const instance = await Innertube.create({
    po_token: poToken,
    visitor_data: visitorData,
    retrieve_player: true,
    generate_session_locally: true,
    cache: new UniversalCache(false),
    lang: 'en',
    location: 'US',
  });
  cached = { instance, poToken, visitorData, createdAt: now };
  return instance;
}

interface VideoCandidate {
  id: string;
  title: string;
  channel: string;
  durationSec: number | null;
}

export async function searchVideos(query: string, limit = 10): Promise<VideoCandidate[]> {
  const yt = await getInnertube();
  const result = await yt.search(query, { type: 'video' });
  const out: VideoCandidate[] = [];
  for (const item of (result.results ?? []) as any[]) {
    const id: string | undefined = item.video_id ?? item.id;
    if (!id || typeof id !== 'string' || id.length !== 11) continue;
    out.push({
      id,
      title: item.title?.text ?? '',
      channel: item.author?.name ?? '',
      durationSec: item.duration?.seconds ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getStreamUrl(videoId: string): Promise<string | null> {
  try {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    const status = (info as any).playability_status?.status;
    if (status && status !== 'OK') {
      console.warn(`[innertube] ${videoId} not OK: ${(info as any).playability_status?.reason}`);
      return null;
    }

    // Try in descending quality order:
    //   1. 720p video-only (adaptive, no audio — Spotify supplies that)
    //   2. any video-only (fallback adaptive — 480p/360p)
    //   3. muxed (360p with audio; client mutes it). Last resort because
    //      PoToken sometimes still strips ciphers from adaptive formats —
    //      muxed has historically been the most reliable path.
    const tries: Array<{ type: 'video' | 'video+audio'; quality?: string }> = [
      { type: 'video', quality: '720p' },
      { type: 'video' },
      { type: 'video+audio' },
    ];
    for (const opts of tries) {
      try {
        const format = info.chooseFormat(opts);
        if (!format) continue;
        const url = await Promise.resolve(format.decipher(yt.session.player));
        if (typeof url !== 'string' || !url) continue;
        return url;
      } catch (err) {
        console.warn(
          `[innertube] chooseFormat(${JSON.stringify(opts)}) failed for ${videoId}: ${(err as Error).message}`,
        );
      }
    }
    return null;
  } catch (err) {
    console.warn(`[innertube] getInfo failed for ${videoId}: ${(err as Error).message}`);
    return null;
  }
}
