// SubtitleTrack is a PERSISTENT, per-mode caption/translation preference — not
// a rendered feed item. Its props (primary/secondary language codes) are read
// by the watch-page TranscriptPanel, which fetches each video's real captions
// (native YouTube track when available, else machine-translated) and shows
// them dual-column. As a feed section it renders nothing: it's pure config that
// survives reloads and applies to every video watched in the mode.

import type { PageConfig, Section } from '@showcase/shared';

export function SubtitleTrack(_props: { section: Section; config: PageConfig }): null {
  return null;
}
