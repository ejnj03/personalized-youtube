// Shared caption/subtitle model. Both hosts produce these:
//   - YouTube: native transcript (getTranscript) → the timed ANCHOR.
//   - Spotify: LRClib synced lyrics → the anchor.
// Additional languages are produced by translating the anchor's cues
// line-for-line (translateCues), reusing the anchor's timestamps — so every
// track in a set is index-aligned (cue i shares start/end across languages).

// A piece of a translated line. `fromTarget` = this segment was ALREADY in the
// target language in the source (a mixed-language line, e.g. K-pop "숨겨도
// twinkle 나를 봐" → English keeps "Twinkle") and is preserved verbatim — UIs
// color-code these differently. `fromTarget: false` = translated from another
// language.
export interface CaptionToken {
  text: string;
  fromTarget: boolean;
}

export interface CaptionCue {
  /** Seconds from media start. */
  start: number;
  /** Seconds; optional (some sources only give start). */
  end?: number;
  /** The full line as plain text (always present — concat of token texts). */
  text: string;
  /** Per-segment language tagging for merge-translated, multilingual lines. */
  tokens?: CaptionToken[];
}

export interface CaptionTrack {
  /** BCP-47-ish language code, e.g. 'en', 'ko', 'ja'. */
  lang: string;
  /** Where the cues came from: the native anchor, or an LLM translation. */
  source: 'native' | 'translated';
  cues: CaptionCue[];
}
