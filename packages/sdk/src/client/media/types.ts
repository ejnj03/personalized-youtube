// Host-agnostic shape passed into the SDK's <MediaCard>. Hosts map their
// domain object (Video, Track, Episode, Album, Book) into this shape via
// a thin per-host wrapper component.
//
// Two usage modes:
// (1) Legacy fixed-position render — host populates the named fields and
//     MediaCard renders them in a fixed structure gated by preset flags.
// (2) Slot-tree render — when MediaCardProps.layout is set, the agent's
//     emitted layout walks the item by source string. Hosts can add extra
//     keys (custom badges, fields the agent might reference); the indexer
//     `[key: string]` accepts them.

import type { ReactNode } from 'react';

export interface MediaItem {
  // Indexable so slot-tree lookups (`item[source]`) work for any registered
  // host field. Use the named fields below for the common cases.
  [key: string]: unknown;
  /** Cover image URL — thumbnail, album art, book cover, etc. */
  cover: string;
  /** Alt text for the cover image. */
  alt?: string;
  /** Primary text shown beneath (or beside, in horizontal) the cover. */
  title: string;
  /** Secondary line below the title. Host fills with channel / artist /
   *  author / show / etc. */
  subtitle?: string;
  /** Marks the subtitle as verified (renders a ✓ badge next to it). */
  subtitleVerified?: boolean;
  /** Optional avatar shown next to the meta block in vertical orientation. */
  avatar?: ReactNode;
  /** Badge text on the cover bottom-right (e.g. "13:56" for duration). */
  badge?: string;
  /** Primary engagement stat — "1.2M views", "234K plays". */
  stats?: string;
  /** Publish/release/upload timestamp string — "2 days ago". */
  timestamp?: string;
  /** Long-form description shown beneath the meta line when the preset
   *  enables it (or always, in horizontal orientation). */
  description?: string;
}
