// Zod schema for CardLayout — used by hosts that include cardLayout in
// their ThemeSchema. Recursive (row.children) via z.lazy.

import { z } from 'zod';
import type { SlotNode, CardLayout } from './layout-types';

const SlotTextSize = z.enum(['xs', 'sm', 'base', 'lg']);
const SlotTextColor = z.enum(['inherit', 'white', 'accent', 'mutedFg']);
const SlotAvatarSize = z.enum(['sm', 'md', 'lg']);
const SlotAvatarShape = z.enum(['circle', 'square']);
const SlotBadgeColor = z.enum(['accent', 'neutral', 'live']);
const SlotRowAlign = z.enum(['start', 'center']);

// Leaf nodes — the three primitives that hold content. No nesting.
const TextNodeSchema = z.object({
  kind: z.literal('text'),
  source: z.string(),
  weight: z.number().int().min(100).max(900).optional(),
  size: SlotTextSize.optional(),
  color: SlotTextColor.optional(),
  maxLines: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

const AvatarNodeSchema = z.object({
  kind: z.literal('avatar'),
  source: z.string(),
  size: SlotAvatarSize.optional(),
  shape: SlotAvatarShape.optional(),
});

const BadgeNodeSchema = z.object({
  kind: z.literal('badge'),
  source: z.string(),
  color: SlotBadgeColor.optional(),
});

const LeafSlotNodeSchema = z.discriminatedUnion('kind', [
  TextNodeSchema,
  AvatarNodeSchema,
  BadgeNodeSchema,
]);

// Row schema with bounded recursion: rows can contain leaves OR a column
// (so the proper YouTube card — avatar left, stacked title/channel/meta
// right — is expressible). Column children are limited to leaves OR a
// row, so depth caps at 3 in the worst case (row→column→row→leaves) but
// the recursion still terminates without `z.lazy`.
const RowNodeSchema = z.object({
  kind: z.literal('row'),
  children: z.array(LeafSlotNodeSchema),
  gap: z.number().int().min(0).max(64).optional(),
  align: SlotRowAlign.optional(),
});

// Column = vertical stack. Children can include rows (for inline meta
// lines like stats+timestamp side by side inside a vertical stack).
const ColumnNodeSchema = z.object({
  kind: z.literal('column'),
  children: z.array(z.union([LeafSlotNodeSchema, RowNodeSchema])),
  gap: z.number().int().min(0).max(64).optional(),
});

// Row at the OUTER level can hold leaves + a column (one level of
// nesting). Defined as a separate schema so the discriminated union stays
// non-recursive.
const RowWithColumnSchema = z.object({
  kind: z.literal('row'),
  children: z.array(z.union([LeafSlotNodeSchema, ColumnNodeSchema])),
  gap: z.number().int().min(0).max(64).optional(),
  align: SlotRowAlign.optional(),
});

export const SlotNodeSchema: z.ZodType<SlotNode> = z.discriminatedUnion('kind', [
  TextNodeSchema,
  AvatarNodeSchema,
  BadgeNodeSchema,
  RowWithColumnSchema,
  ColumnNodeSchema,
]);

export const OverlayNodeSchema = z.object({
  position: z.enum(['tl', 'tr', 'bl', 'br', 'center', 'topBand', 'bottomBand']),
  contents: z.union([SlotNodeSchema, z.array(SlotNodeSchema)]),
  gradient: z.boolean().optional(),
});

export const CoverNodeSchema = z.object({
  source: z.string(),
  fit: z.enum(['cover', 'contain']).optional(),
  aspect: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).optional(),
});

export const CardLayoutSchema: z.ZodType<CardLayout> = z
  .object({
    above: z.array(SlotNodeSchema).optional(),
    cover: CoverNodeSchema.optional(),
    overlays: z.array(OverlayNodeSchema).optional(),
    below: z.array(SlotNodeSchema).optional(),
    aside: z.array(SlotNodeSchema).optional(),
  })
  .describe(
    'Full slot-tree layout for a media card. Visitors can ask for novel ' +
      'arrangements ("instagram style with profile at top", "shorts-style ' +
      'overlay title", "movie poster with caption on the image") and the ' +
      'agent emits a fresh layout tree. Grammar:\n' +
      '• above[] / below[] — slot stacks above and below the cover\n' +
      '• cover — the image area (source + optional fit/aspect override)\n' +
      '• overlays[] — text/badges on top of the cover. position: corners ' +
      '(tl/tr/bl/br), center, or full-width bands (topBand/bottomBand)\n' +
      '• aside[] — horizontal-orientation only, content right of the cover\n' +
      'Slot node kinds: text | avatar | badge | row | column. text/avatar/' +
      'badge carry a `source` — the MediaItem field name (e.g. "title", ' +
      '"subtitle", "channelAvatar", "duration"). row arranges children ' +
      'horizontally, column arranges them vertically. The proper YouTube ' +
      'card is `row(avatar, column(title, subtitle, row(stats, timestamp)))` ' +
      '— avatar left of a vertical stack. row children can be leaves or a ' +
      'column; column children can be leaves or a row. Do NOT nest a row ' +
      'inside another row or a column inside another column. For overlaid ' +
      'white-on-image text (Shorts / movie posters / Now Playing) use ' +
      '{position:"bottomBand", gradient:true, contents:[{kind:"text", ' +
      'source:"title", color:"white"}]}.',
  );
