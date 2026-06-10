import { z } from 'zod';
import { DEFAULT_CARD_PRESETS } from './catalog';
import type { CardPresetCatalog, CardPreset, CardAspect } from './types';

/**
 * CSS aspect-ratio value for a preset's aspect string. Returned as a plain
 * value so hosts can spread it into a style object:
 *   <div style={{ aspectRatio: aspectRatioCss(preset.aspect) }} />
 *
 * Inline style is portable across Tailwind / vanilla CSS / CSS-in-JS,
 * unlike Tailwind utility classes that need the host's content scanner
 * to know about the strings.
 */
export function aspectRatioCss(aspect: CardAspect): string {
  // CSS aspect-ratio accepts "W / H"; converting "16:9" → "16 / 9".
  return aspect.replace(':', ' / ');
}

export interface DefineCardPresetsOptions {
  /** Which catalog entry is chosen when no patch has set one yet. */
  defaultKey?: string;
  /** If true, replace DEFAULT_CARD_PRESETS entirely instead of merging. */
  replace?: boolean;
}

/**
 * Build the Zod schemas + resolved catalog for a host's card presets.
 *
 * Hosts call this in their ThemeSchema. Two schema pieces come back:
 *  - `schema`        — Zod enum of catalog keys (used by `theme.cardPreset`)
 *  - `overrideSchema`— Zod object of partial CardPreset (used by
 *                      `theme.cardOverrides`); lets visitor prompts nudge
 *                      individual fields on top of the chosen preset.
 *
 * @example
 *   const cards = defineCardPresets({});            // SDK defaults only
 *   const cards = defineCardPresets({ my_card: {…} });  // extend
 *   const cards = defineCardPresets(myCatalog, { replace: true });
 *
 *   // In ThemeSchema:
 *   cardPreset:    cards.schema,
 *   cardOverrides: cards.overrideSchema,
 */
export function defineCardPresets(
  overrides: CardPresetCatalog = {},
  options: DefineCardPresetsOptions = {},
) {
  const { defaultKey = 'video_card', replace = false } = options;
  const catalog: CardPresetCatalog = replace
    ? overrides
    : { ...DEFAULT_CARD_PRESETS, ...overrides };

  const keys = Object.keys(catalog) as [string, ...string[]];
  if (keys.length === 0) throw new Error('defineCardPresets: catalog is empty');

  // Each line lists a key + its description — flows into Claude's
  // tool-defs prompt cache so it can pick by vibe.
  const catalogText = keys
    .map((k) => `- ${k}: ${catalog[k]!.description}`)
    .join('\n');

  const schema = z
    .enum(keys)
    .default(keys.includes(defaultKey) ? defaultKey : keys[0])
    .describe(
      `The named card archetype used to render every media card on the ` +
        `page. Switching the preset changes aspect ratio, density, what ` +
        `meta is visible, and hover behavior in one move. Options:\n` +
        catalogText,
    );

  // Override schema: partial of CardPreset so visitor prompts can nudge
  // a single field ("but make titles bolder") without inventing a new
  // preset. Merged AFTER the preset is resolved.
  const overrideSchema = z
    .object({
      aspect: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).optional(),
      orientation: z.enum(['vertical', 'horizontal']).optional(),
      coverScale: z.number().min(0.5).max(2).optional(),
      coverSaturate: z.number().min(0).max(1.5).optional(),
      coverFit: z.enum(['cover', 'contain']).optional(),
      hoverEffect: z.enum(['none', 'lift', 'zoom']).optional(),
      showDescription: z.boolean().optional(),
      showStats: z.boolean().optional(),
      showTimestamp: z.boolean().optional(),
      showDuration: z.boolean().optional(),
      hideMeta: z.boolean().optional(),
    })
    .partial()
    .default({})
    .describe(
      `Per-field overrides applied AFTER the chosen card preset. Use ` +
        `sparingly — prefer switching cardPreset to express a different ` +
        `look. Reach for this only when the user asks for one specific ` +
        `tweak (e.g. "make titles bolder", "show duration too").`,
    );

  return { schema, overrideSchema, catalog };
}

/**
 * Resolve the effective card preset for rendering — pure function so
 * components and tests can both call it.
 *
 *   preset       = catalog[theme.cardPreset]
 *   sectionPreset= catalog[section?.cardPreset]  (if set)
 *   final        = { ...preset, ...theme.cardOverrides, ...sectionPreset? }
 *
 * Section's preset replaces the theme preset wholesale; theme-level
 * overrides STILL apply on top so "globally bolder titles" survives a
 * per-section preset switch.
 */
export function resolveCardPreset(
  catalog: CardPresetCatalog,
  themePresetKey: string,
  themeOverrides: Partial<CardPreset> = {},
  sectionPresetKey?: string,
): CardPreset {
  const themePreset = catalog[themePresetKey] ?? catalog['video_card']!;
  const base = sectionPresetKey && catalog[sectionPresetKey]
    ? catalog[sectionPresetKey]!
    : themePreset;
  return { ...base, ...themeOverrides };
}
