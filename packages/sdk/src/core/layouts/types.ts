// Layout preset = how a collection of cards is arranged on the page.
// Independent of what each card looks like (that's CardPreset).
//
// Three kinds today:
//   - 'grid'    — multi-column wrap-as-needed
//   - 'row'     — horizontal track (scrolling)
//   - 'magazine'— 2-column with alternating heights (editorial look)

export type LayoutKind = 'grid' | 'row' | 'magazine';

export interface LayoutPreset {
  kind: LayoutKind;
  /** For grid: columns at desktop width. For row: how many cards visible
   *  at once. Magazine kind ignores this. */
  columns: number;
  /** Gap between cards in pixels. */
  gap: number;
  /** Row-only: enable CSS scroll-snap for tidy paginated swiping. */
  scrollSnap: boolean;
  /** Cap on the collection's max width in pixels. Mostly relevant for
   *  single-column grids — without a cap, a 1-column layout balloons each
   *  card to the full viewport width on desktop. Default (undefined) =
   *  no cap, fills available space. Centers within the parent. */
  maxWidth?: number;
  /** Human-readable summary for Claude's tool prompt. */
  description: string;
}

export type LayoutPresetCatalog = Record<string, LayoutPreset>;
