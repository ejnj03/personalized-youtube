import { z, type ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { AnthropicTool, DefineHostInput } from './contract';

// Helper: convert a Zod schema → JSON Schema in the shape Anthropic expects.
// `s as any` bypasses zod-to-json-schema's deeply-recursive generics, which
// trip TS2589 under `moduleResolution: Node`. Runtime behavior unchanged.
function toJsonSchema(s: ZodTypeAny): object {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodToJsonSchema(s as any, { target: 'jsonSchema7', $refStrategy: 'none' }) as object;
}

/**
 * Derive the Anthropic tool definitions array from a host config.
 * Called once at defineHost() time; the result is cached on HostConfig.toolDefinitions.
 *
 * Every host gets these 7 tools. Host-specific concerns (theme shape, section
 * type enum) are folded in from host.theme.schema and host.sections.
 */
export function buildToolDefinitions(host: DefineHostInput): AnthropicTool[] {
  const sectionTypeNames = Object.keys(host.sections);

  // The schemas we DERIVE from host config:

  // update_theme — take whatever the host declared as theme.schema
  // Use a cast because ZodTypeAny doesn't expose .partial(); hosts pass a ZodObject in practice.
  const updateThemeInput = (host.theme.schema as unknown as z.ZodObject<z.ZodRawShape>).partial();

  // add_section — type enum constrained to host's registered section types
  const addSectionInput = z.object({
    type: sectionTypeNames.length > 0
      ? z.enum(sectionTypeNames as [string, ...string[]])
      : z.string(),
    props: z.record(z.any()),
    position: z.union([
      z.object({ before: z.string() }),
      z.object({ after: z.string() }),
      z.object({ index: z.number().int().nonnegative() }),
    ]),
    rationale: z.string().optional(),
  });

  // The schemas that are FULLY generic (no host fields):
  const updateSectionInput = z.object({
    sectionId: z.string(),
    patch: z.record(z.any()),
    rationale: z.string().optional(),
  });

  const removeSectionInput = z.object({
    sectionId: z.string(),
    rationale: z.string().optional(),
  });

  const reorderSectionsInput = z.object({
    order: z.array(z.string()).min(1),
    rationale: z.string().optional(),
  });

  const requestMoreContentInput = z.object({
    category: z.string(),
    count: z.number().int().min(1).max(20).default(8),
    style: z.string().optional(),
    // append (default) vs swap. Set true when the visitor wants the surface to
    // show ONLY this content ("just/only X", "switch to X", "show me X
    // instead"); leave false/omitted for additive requests ("more X", "also
    // add some X").
    replace: z.boolean().optional(),
  });

  const askUserInput = z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
  });

  return [
    {
      name: 'update_section',
      description:
        'Edit one or more props of a single existing section by id. Use for nearly all aesthetic and content edits.',
      input_schema: toJsonSchema(updateSectionInput),
    },
    {
      name: 'update_theme',
      description:
        'Change theme-level settings. Pass theme fields you want to change DIRECTLY at the top level — do NOT wrap them in a "patch" key. Available fields are defined by the host\'s theme schema.',
      input_schema: toJsonSchema(updateThemeInput),
    },
    {
      name: 'add_section',
      description:
        'Inject a new section at a position relative to an existing section id (before/after) or at a numeric index. Section type must be one of the registered types.',
      input_schema: toJsonSchema(addSectionInput),
    },
    {
      name: 'remove_section',
      description:
        'Remove a section by id. Use when the visitor asks to hide a section entirely.',
      input_schema: toJsonSchema(removeSectionInput),
    },
    {
      name: 'reorder_sections',
      description:
        'Reorder sections by passing the FULL new order of section ids. Use for "move X to top", "swap A and B", etc. — never combine remove_section + add_section as a workaround.',
      input_schema: toJsonSchema(reorderSectionsInput),
    },
    {
      name: 'request_more_content',
      description:
        'Request content in a specific category. The host\'s onRequestMoreContent handler decides what this actually fetches (videos, tracks, products, etc.). Set `replace: true` to SWAP the surface to show ONLY this content ("only/just X", "switch to X"); omit it to APPEND ("more X", "also add X").',
      input_schema: toJsonSchema(requestMoreContentInput),
    },
    {
      name: 'ask_user',
      description:
        'Ask the visitor a clarifying question. Use sparingly — only when the request would ambiguously affect multiple sections AND the choice is not cheaply reversible.',
      input_schema: toJsonSchema(askUserInput),
    },
  ];
}
