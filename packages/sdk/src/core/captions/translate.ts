import { createAnthropicClient, MODEL_HAIKU } from '../anthropic';
import type { CaptionCue, CaptionToken } from './types';

export interface TranslateCuesOptions {
  apiKey: string;
  /** Source language hint — improves quality. Optional. */
  sourceLang?: string;
  /** Model override. Defaults to Haiku (cheap, fast, fine for subtitles). */
  model?: string;
  /** Lines per LLM call. Default 50. */
  batchSize?: number;
}

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// Translate one batch of subtitle lines → returns a same-length array. On any
// failure (bad JSON, length mismatch) falls back to the source line for the
// affected slots — a visible source line beats a blank caption.
async function translateBatch(
  client: ReturnType<typeof createAnthropicClient>,
  model: string,
  texts: string[],
  targetLang: string,
  sourceLang?: string,
): Promise<string[]> {
  const system =
    `You are a subtitle translator. Translate each input line into ${targetLang}` +
    (sourceLang ? ` (source language: ${sourceLang})` : '') +
    `. Keep translations natural, concise, and subtitle-appropriate. Return ONLY a ` +
    `JSON array of strings — exactly one translation per input line, in the same ` +
    `order and same length. No commentary, no code fences.`;

  const resp = await client.messages.create({
    model,
    max_tokens: Math.min(8192, texts.length * 80 + 512),
    system,
    messages: [{ role: 'user', content: JSON.stringify(texts) }],
  } as Parameters<typeof client.messages.create>[0]);

  const raw = ((resp as { content?: Array<{ type?: string; text?: string }> }).content ?? [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  try {
    const arr = JSON.parse(stripFences(raw)) as unknown;
    if (Array.isArray(arr)) {
      return texts.map((t, i) => (typeof arr[i] === 'string' ? (arr[i] as string) : t));
    }
  } catch {
    /* fall through to source text */
  }
  return texts;
}

/**
 * Translate an anchor track's cues into `targetLang`, reusing each cue's
 * timestamps verbatim so the result is index-aligned with the anchor. Batches
 * the lines and runs the batches concurrently.
 *
 * Pure function of (cues, targetLang) → cache the result hard upstream.
 */
export async function translateCues(
  cues: CaptionCue[],
  targetLang: string,
  opts: TranslateCuesOptions,
): Promise<CaptionCue[]> {
  if (cues.length === 0) return [];
  const client = createAnthropicClient({ apiKey: opts.apiKey });
  const model = opts.model ?? MODEL_HAIKU;
  const batchSize = opts.batchSize ?? 50;

  const batches: string[][] = [];
  for (let i = 0; i < cues.length; i += batchSize) {
    batches.push(cues.slice(i, i + batchSize).map((c) => c.text));
  }

  const translatedBatches = await Promise.all(
    batches.map((texts) => translateBatch(client, model, texts, targetLang, opts.sourceLang)),
  );
  const translated = translatedBatches.flat();

  // Index-aligned: only the text changes; start/end come from the anchor.
  return cues.map((c, i) => ({ start: c.start, end: c.end, text: translated[i] ?? c.text }));
}

// ─── Tokenized (merge) translation for multilingual lines ────────────────

type RawSeg = { t?: unknown; k?: unknown };

// Translate ONE batch into per-line token arrays. Each line → segments marked
// `k` (kept = already target language). Falls back to a single translated/raw
// segment per line on any failure.
async function translateBatchTokenized(
  client: ReturnType<typeof createAnthropicClient>,
  model: string,
  texts: string[],
  targetLang: string,
): Promise<CaptionToken[][]> {
  const system =
    `You translate song lyrics into ${targetLang}, line by line. Input lines may MIX ` +
    `languages (e.g. Korean + English). For EACH line: produce a natural ${targetLang} ` +
    `translation, but any words that were ALREADY in ${targetLang} in the source must be ` +
    `preserved VERBATIM and flagged. Return ONLY a JSON array with one element per input ` +
    `line; each element is an array of segments {"t": string, "k": boolean} where k=true ` +
    `means that segment was already ${targetLang} in the source (kept as-is), k=false means ` +
    `translated. Concatenating the "t" values in order must read as the full natural ` +
    `translation. Example (target English) for input ["숨겨도 twinkle 나를 봐"]: ` +
    `[[{"t":"Look at me ","k":false},{"t":"Twinkle","k":true},{"t":" even when I hide it","k":false}]]`;

  const resp = await client.messages.create({
    model,
    max_tokens: Math.min(8192, texts.join('').length * 6 + 1024),
    system,
    messages: [{ role: 'user', content: JSON.stringify(texts) }],
  } as Parameters<typeof client.messages.create>[0]);

  const raw = ((resp as { content?: Array<{ type?: string; text?: string }> }).content ?? [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  try {
    const arr = JSON.parse(stripFences(raw)) as unknown;
    if (Array.isArray(arr)) {
      return texts.map((src, i) => {
        const line = arr[i];
        if (Array.isArray(line)) {
          const tokens = (line as RawSeg[])
            .map((s) => ({
              text: typeof s.t === 'string' ? s.t : '',
              fromTarget: s.k === true,
            }))
            .filter((tok) => tok.text.length > 0);
          if (tokens.length > 0) return tokens;
        }
        return [{ text: src, fromTarget: false }];
      });
    }
  } catch {
    /* fall through */
  }
  return texts.map((src) => [{ text: src, fromTarget: false }]);
}

/**
 * Like translateCues, but returns each cue with `tokens` marking which segments
 * were already in the target language (kept verbatim). For multilingual lyrics
 * — translate the foreign parts, keep the target-language words, tag both so a
 * UI can color-code by language. `text` is the joined plain translation.
 *
 * Pure function of (cues, targetLang) → cache the result hard upstream.
 */
export async function translateCuesTokenized(
  cues: CaptionCue[],
  targetLang: string,
  opts: TranslateCuesOptions,
): Promise<CaptionCue[]> {
  if (cues.length === 0) return [];
  const client = createAnthropicClient({ apiKey: opts.apiKey });
  const model = opts.model ?? MODEL_HAIKU;
  const batchSize = opts.batchSize ?? 30;

  const batches: string[][] = [];
  for (let i = 0; i < cues.length; i += batchSize) {
    batches.push(cues.slice(i, i + batchSize).map((c) => c.text));
  }
  const translatedBatches = await Promise.all(
    batches.map((texts) => translateBatchTokenized(client, model, texts, targetLang)),
  );
  const tokenLines = translatedBatches.flat();

  return cues.map((c, i) => {
    const tokens = tokenLines[i] ?? [{ text: c.text, fromTarget: false }];
    return { start: c.start, end: c.end, text: tokens.map((t) => t.text).join(''), tokens };
  });
}
