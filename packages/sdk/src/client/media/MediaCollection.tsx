'use client';

import type { ReactNode, CSSProperties } from 'react';
import type { LayoutPreset } from '../../core/layouts';
import type { CardOrientation } from '../../core/cards';

// Responsive Tailwind column classes for grid layouts. We list 1–5 because
// the SDK's default layout catalog only ships those columns; hosts that
// extend the catalog with columns >5 won't get a Tailwind class match and
// fall back to inline grid-template-columns.
const COLUMN_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

export interface MediaCollectionProps {
  /** Fully resolved layout preset (call resolveLayoutPreset first). */
  preset: LayoutPreset;
  /**
   * Card orientation, when known. Horizontal cards are wide rows that
   * don't tile in row layouts or >2-column grids — passing this lets
   * MediaCollection apply that constraint automatically so every host
   * doesn't have to repeat the same override logic.
   */
  cardOrientation?: CardOrientation;
  /** Cards (or host wrappers like <VideoCard>) to arrange. */
  children: ReactNode;
  /** Extra classes appended to the outer container (host padding etc.). */
  className?: string;
}

// Apply cross-cutting layout constraints that depend on the card's shape.
// Today there's one: horizontal cards must render in a ≤2-column grid
// (they're wide, they squish in rows or denser grids). Centralising here
// means hosts don't have to re-derive an "effectiveLayoutPreset".
function applyOrientationConstraint(
  preset: LayoutPreset,
  orientation: CardOrientation | undefined,
): LayoutPreset {
  if (orientation !== 'horizontal') return preset;
  return {
    ...preset,
    kind: 'grid',
    columns: Math.min(preset.columns, 2),
  };
}

/**
 * Host-agnostic collection container — picks the right CSS for the layout
 * preset's `kind` (grid / row / magazine). Hosts pass already-filtered
 * children; this component only owns the arrangement, not the data.
 */
export function MediaCollection({
  preset: rawPreset,
  cardOrientation,
  children,
  className = '',
}: MediaCollectionProps) {
  const preset = applyOrientationConstraint(rawPreset, cardOrientation);
  const gapStyle: CSSProperties = { gap: `${preset.gap}px` };

  if (preset.kind === 'row') {
    return (
      <div
        className={`-mx-6 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        <div
          className={`flex ${preset.scrollSnap ? 'snap-x snap-mandatory' : ''}`}
          style={gapStyle}
        >
          {/* Each direct child gets snap-start + a width based on visible
              columns. Host passes raw card children; we wrap them lightly. */}
          {childrenAsRowItems(children, preset)}
        </div>
      </div>
    );
  }

  if (preset.kind === 'magazine') {
    // Two-column with alternating heights via :nth-child. The actual
    // height variation comes from `grid-auto-rows` + alternating row-span
    // — simplest implementation that still reads "magazine".
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${className}`}
        style={gapStyle}
      >
        {children}
      </div>
    );
  }

  // grid kind
  const colClasses = COLUMN_CLASSES[preset.columns] ?? COLUMN_CLASSES[4];
  const wrapperStyle: CSSProperties | undefined = preset.maxWidth
    ? { maxWidth: preset.maxWidth, marginLeft: 'auto', marginRight: 'auto' }
    : undefined;

  return (
    <div className={`grid ${colClasses} ${className}`} style={{ ...wrapperStyle, ...gapStyle }}>
      {children}
    </div>
  );
}

// Row variant wraps each direct child in a fixed-width container so the
// row reads as a row of equal cards regardless of card content. The width
// is roughly viewport / preset.columns minus the gap.
function childrenAsRowItems(children: ReactNode, preset: LayoutPreset): ReactNode {
  const arr = Array.isArray(children) ? children : [children];
  return arr.map((child, i) => (
    <div
      key={i}
      className={`shrink-0 ${preset.scrollSnap ? 'snap-start' : ''}`}
      style={{ width: `calc((100% - ${preset.gap * (preset.columns - 1)}px) / ${preset.columns})` }}
    >
      {child}
    </div>
  ));
}
