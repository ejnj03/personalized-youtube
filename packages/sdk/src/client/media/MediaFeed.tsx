'use client';

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  Fragment,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { LayoutPreset } from '../../core/layouts';
import type { CardOrientation } from '../../core/cards';
import { MediaCollection } from './MediaCollection';

/**
 * Imperative handle for driving a <MediaFeed> from outside (a chat tool-call,
 * a "load more" button, a category switch). Grab it with a ref.
 *
 *   const feed = useRef<MediaFeedHandle<Video>>(null);
 *   // chat asked for "more jazz" → add to the current feed:
 *   await feed.current?.append('jazz');
 *   // chat asked for "ONLY jazz" → replace the feed:
 *   await feed.current?.swap('jazz');
 */
export interface MediaFeedHandle<T> {
  /**
   * Call `provideContent(arg)` and APPEND the surfaced items to the feed,
   * skipping any whose `itemKey` is already present. Returns what the
   * provider surfaced (pre-dedupe) so callers can react (e.g. toast "+8").
   */
  append: (arg?: unknown) => Promise<T[]>;
  /**
   * Call `provideContent(arg)` and SWAP (replace) the feed with the surfaced
   * items — the "only X" path. Returns the new items.
   */
  swap: (arg?: unknown) => Promise<T[]>;
  /** Replace items directly, without calling the provider. */
  setItems: (items: T[]) => void;
  /** Snapshot of the current items. */
  getItems: () => T[];
}

export interface MediaFeedProps<T> {
  /** Fully resolved layout preset (call resolveLayoutPreset first). */
  preset: LayoutPreset;
  /** Card orientation, forwarded to MediaCollection for its row/grid constraint. */
  cardOrientation?: CardOrientation;
  /** Extra classes on the collection container. */
  className?: string;
  /** Items rendered on first mount. */
  initialItems?: T[];
  /**
   * The single integration point: a function that SURFACES an array of items
   * on demand. It receives whatever `arg` the caller passes to append()/swap()
   * (a search query, a category, a continuation token, …) and returns the
   * items. The host decides where they come from — a `/search` fetch, a
   * generator, a cache. MediaFeed then either appends or swaps them in.
   */
  provideContent: (arg?: unknown) => Promise<T[]>;
  /** Map one item → a card node (the host's <VideoCard>, <TrackCard>, …). */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable key per item — used for React keys AND append-dedupe. */
  itemKey: (item: T) => string;
}

function MediaFeedInner<T>(
  {
    preset,
    cardOrientation,
    className,
    initialItems = [],
    provideContent,
    renderItem,
    itemKey,
  }: MediaFeedProps<T>,
  ref: ForwardedRef<MediaFeedHandle<T>>,
) {
  const [items, setItems] = useState<T[]>(initialItems);

  const append = useCallback(
    async (arg?: unknown): Promise<T[]> => {
      const more = await provideContent(arg);
      setItems((cur) => {
        const seen = new Set(cur.map(itemKey));
        return [...cur, ...more.filter((m) => !seen.has(itemKey(m)))];
      });
      return more;
    },
    [provideContent, itemKey],
  );

  const swap = useCallback(
    async (arg?: unknown): Promise<T[]> => {
      const next = await provideContent(arg);
      setItems(next);
      return next;
    },
    [provideContent],
  );

  useImperativeHandle(
    ref,
    () => ({ append, swap, setItems, getItems: () => items }),
    [append, swap, items],
  );

  return (
    <MediaCollection preset={preset} cardOrientation={cardOrientation} className={className}>
      {items.map((item, i) => (
        <Fragment key={itemKey(item)}>{renderItem(item, i)}</Fragment>
      ))}
    </MediaCollection>
  );
}

/**
 * Host-agnostic, data-owning content row/grid. Composes <MediaCollection> for
 * arrangement, but unlike MediaCollection it OWNS its item list and exposes an
 * imperative `append` / `swap` API driven by a `provideContent` surfacing
 * function. Generic over the host's item type (Video, Track, Episode, …).
 *
 * This is the reusable form of the YouTube clone's request_more_content
 * handler — "fetch some items, then either add them to the feed or replace
 * it" — lifted out of the host so any surface can do append-or-swap.
 */
export const MediaFeed = forwardRef(MediaFeedInner) as <T>(
  props: MediaFeedProps<T> & { ref?: ForwardedRef<MediaFeedHandle<T>> },
) => ReactElement;
