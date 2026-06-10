// Shared captions/subtitles: a timed-cue model both hosts produce (YouTube via
// native transcript, Spotify via synced lyrics) plus translateCues, which
// turns the anchor track into any additional language, index-aligned.

export type { CaptionCue, CaptionTrack, CaptionToken } from './types';
export { translateCues, translateCuesTokenized } from './translate';
export type { TranslateCuesOptions } from './translate';
