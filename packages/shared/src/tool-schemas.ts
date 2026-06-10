import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ThemeSchema } from './schemas/theme';
import { SECTION_TYPES } from './schemas/sections';
import { FilterStateSchema, SortStateSchema } from './page-config';

export const UpdateSectionInput = z.object({
  sectionId: z.string(),
  patch: z.record(z.any()),
  rationale: z.string().optional(),
});

export const UpdateThemeInput = ThemeSchema.partial();

export const SetFilterInput = FilterStateSchema.partial();

export const SetSortInput = SortStateSchema.partial();

export const AddSectionInput = z.object({
  type: z.enum(SECTION_TYPES),
  props: z.record(z.any()),
  position: z.union([
    z.object({ before: z.string() }),
    z.object({ after: z.string() }),
    z.object({ index: z.number().int().nonnegative() }),
  ]),
});

export const RemoveSectionInput = z.object({
  sectionId: z.string(),
});

export const ReorderSectionsInput = z.object({
  order: z.array(z.string()).min(1),
});

export const RequestMoreContentInput = z.object({
  category: z.string(),
  count: z.number().int().min(1).max(20).default(8),
  style: z.string().optional(),
});

export const AskUserInput = z.object({
  question: z.string(),
  options: z.array(z.string()).optional(),
});

const toJsonSchema = (s: z.ZodTypeAny) =>
  zodToJsonSchema(s, { target: 'jsonSchema7', $refStrategy: 'none' });

export const TOOL_DEFINITIONS = [
  {
    name: 'update_section',
    description: 'Edit one or more props of a single existing section by id. Use for nearly all aesthetic and content edits.',
    input_schema: toJsonSchema(UpdateSectionInput),
  },
  {
    name: 'update_theme',
    description: 'Change theme-level settings. Pass the theme fields you want to change DIRECTLY at the top level — do NOT wrap them in a "patch" key. Allowed fields: accent (hex), fontScale ("0.875"|"1"|"1.125"|"1.25"), fontFamily (catalog key), radius ("none"|"sm"|"md"|"lg"|"xl"), background ({kind: "solid"|"gradient"|"paper"|"sampled", from?: hex, to?: hex, angle?: 0-360}), cardPreset (pick a named card archetype — see cardPreset description for options), cardOverrides (sparingly! per-field nudges on top of the preset: {aspect, orientation, coverScale, coverSaturate, coverFit, hoverEffect, showDescription, showStats, showTimestamp, showDuration, hideMeta}), layoutPreset (pick a named collection layout — see layoutPreset description for options), cardLayout (custom slot-tree for rearranging the parts of a card on the spot — see cardLayout description for the grammar; use for prompts like "put creator above the photo", "shorts-style title overlay", "movie poster style", "instagram style with avatar on top"). Prefer cardPreset/layoutPreset over cardOverrides — only fall back to overrides for single-field nudges. Reach for cardLayout only when the visitor asks for an explicit rearrangement that the preset archetypes cannot express. Example: {"accent":"#A78BFA","cardPreset":"square_card","layoutPreset":"grid_oneCol"} — NOT {"patch":{...}}.',
    input_schema: toJsonSchema(UpdateThemeInput),
  },
  {
    name: 'set_filter',
    description: 'Apply or update content filters on the feed: requireTags, blockChannels, exclude tags, duration bounds. Filters compose; pass only fields to change.',
    input_schema: toJsonSchema(SetFilterInput),
  },
  {
    name: 'set_sort',
    description: 'Set how the feed is sorted: by recommended | recent | popular | duration, asc or desc.',
    input_schema: toJsonSchema(SetSortInput),
  },
  {
    name: 'add_section',
    description: 'Inject a new section at a position relative to an existing section id (before/after) or at a numeric index.',
    input_schema: toJsonSchema(AddSectionInput),
  },
  {
    name: 'remove_section',
    description: 'Remove a section by id. Use when the visitor asks to hide a row entirely.',
    input_schema: toJsonSchema(RemoveSectionInput),
  },
  {
    name: 'reorder_sections',
    description: 'Reorder sections by passing the FULL new order of section ids. Use this for "move X to the top" / "swap A and B" / "put recommendations above shorts" — never use remove_section + add_section as a workaround.',
    input_schema: toJsonSchema(ReorderSectionsInput),
  },
  {
    name: 'request_more_content',
    description: 'Fetch more videos in a specific category. Call when the current filter would result in fewer than 5 visible videos. The backend generates fresh videos in 3-5s and appends them to the catalog.',
    input_schema: toJsonSchema(RequestMoreContentInput),
  },
  {
    name: 'ask_user',
    description: 'Ask the visitor a clarifying question. Use sparingly — only when the request would ambiguously affect multiple sections AND the choice is not cheaply reversible.',
    input_schema: toJsonSchema(AskUserInput),
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];
