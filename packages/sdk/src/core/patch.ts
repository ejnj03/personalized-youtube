// Host-agnostic patch model + fold.
//
// `Patch` is the single discriminated union of every editing operation the
// chat pipeline can perform. `applyPatch` folds one into a `PageConfig` and
// returns a new config (no mutation).
//
// The SDK keeps types LOOSE here on purpose: theme, filter, sort, and section
// props are all `Record<string, unknown>`. (Record<K, V> is a typed dictionary, string: unknown type, 
// Hosts that want stricter typing
// declare their own concrete shapes and pass them through the `<T extends
// PageConfig>` generic on `applyPatch` — the SDK preserves their type.

// ─── Types ──────────────────────────────────────────────────────────────

/** Base shape for a single section on a page. */
export interface Section {
  /** Stable id that survives across patches. Never regenerated. */
  id: string;
  /** Component type name — host's section registry resolves this to a React component. */
  type: string;
  /** Section props — opaque from the SDK's perspective; host knows the shape. */
  props: Record<string, unknown>;
}

/**
 * The central data structure of the SDK — a typed description of "the page
 * as it currently is for this visitor" at one moment in time.
 *
 * Every patch transforms one PageConfig into a new PageConfig. The host's
 * React tree renders from it. Persistence stores patches against it. Prompts
 * describe it to Claude.
 *
 * ─── Fields ───
 *
 *   id     Stable identifier for this page instance (DB row id, UUID, etc.).
 *          Different from slug — id is internal, slug is user-facing.
 *          Never mutated by patches.
 *          Example: "01HV-some-uuid"
 *
 *   slug   URL-friendly page name. Included in every chat POST as `pageSlug`;
 *          scopes persistence reads/writes; appears in prompts.
 *          Never mutated by patches.
 *          Example: "streaming-platform", "ecommerce-platform", "social-media-platform"
 *
 *   theme  Visual settings (mode, accent, fonts, spacing, etc.). Shape is
 *          whatever the host's ThemeSchema declares — SDK doesn't commit.
 *          Mutated by: update_theme
 *          Example: { mode: 'dark', accent: '#A78BFA', fontScale: '1.125' }
 *
 *   sections  Ordered array of section instances {id, type, props}. The
 *             renderer walks this list to draw the page top-to-bottom.
 *             Order is significant.
 *             Mutated by: update_section, add_section, remove_section,
 *                         reorder_sections
 *             Example: [
 *               { id: 'top-bar-1', type: 'TopBar', props: { logoText: 'YouTube' } },
 *               { id: 'grid-1', type: 'VideoGrid', props: { columns: 4, videos: [...] } },
 *             ]
 *
 *   filter   Content-filtering preferences. Optional concept — only
 *            meaningful for hosts with feeds. Empty object {} for hosts
 *            that don't filter. Shape is host-defined.
 *            Mutated by: set_filter
 *            Example (YT): { requireTags: ['jazz'], excludeTags: ['hype'] }
 *
 *   sort     Sort-order preferences. Same logic as filter — host-defined
 *            shape, host-specific meaning. Empty object {} if N/A.
 *            Mutated by: set_sort
 *            Example: { by: 'recommended', order: 'desc' }
 *
 *   meta     Page-level metadata for the browser tab.
 *            - title:   <title> shown in the browser tab
 *            - favicon: URL of the tab icon
 *            Currently not patched; reserved for future chat-driven renaming.
 *            Example: { title: 'YouTube', favicon: '/favicon.ico' }
 *
 * ─── Loose typing on theme / filter / sort / props ───
 *
 * Those four fields are typed as Record<string, unknown> because each host
 * has a different shape. The host declares the shape via Zod schemas in
 * defineHost({...}); the SDK uses those schemas to generate tool definitions
 * for Claude. At runtime the SDK accesses keys without knowing their types.
 *
 * This is what makes the SDK universal — same PageConfig shape, different
 * host vocabularies inside.
 *
 * ─── Strict typing for hosts that want it ───
 *
 * applyPatch and applyPatches are generic over T extends PageConfig. A host
 * can pass a strict PageConfig (with concrete inferred shape from its Zod
 * schemas) and get the same strict type back — the SDK preserves it through
 * the generic. The loose internal typing never leaks to the host.
 */
export interface PageConfig {
  id: string;
  slug: string;
  theme: Record<string, unknown>;
  sections: Section[];
  filter: Record<string, unknown>;
  sort: Record<string, unknown>;
  meta: { title: string; favicon: string };
}

/** The discriminated union of every editing operation. */
export type Patch =
  | { op: 'update_section'; sectionId: string; patch: Record<string, unknown> }
  | { op: 'update_theme'; patch: Record<string, unknown> }
  | { op: 'set_filter'; filter: Record<string, unknown> }
  | { op: 'set_sort'; sort: Record<string, unknown> }
  | {
      op: 'add_section';
      sectionType: string;
      props: Record<string, unknown>;
      position: { before?: string; after?: string; index?: number };
    }
  | { op: 'remove_section'; sectionId: string }
  | { op: 'reorder_sections'; order: string[] };

/** Per-call options for hosts that want to influence behavior of specific ops. */
export interface ApplyPatchOptions {
  /**
   * Hook invoked when applying an `add_section` patch. Receives the draft
   * section and returns the parsed / defaulted section to insert. Hosts use
   * this to run the draft through their Zod schema so defaults materialize.
   *
   * If omitted, the draft is inserted as-is.
   */
  parseSection?: (draft: Section) => Section;
}

// ─── deepMerge ──────────────────────────────────────────────────────────

/**
 * Folds `source` into `target` recursively. Plain objects merge; primitives
 * and arrays replace wholesale; `null` removes the key entirely.
 *
 * Used to fold partial patch payloads into the existing theme / section
 * props without callers having to restate every field.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === null) {
      delete out[key];
    } else if (
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

// ─── applyPatch ─────────────────────────────────────────────────────────

/**
 * Fold one patch into a page config. Returns a new config (never mutates
 * the input). Reference-preserves unchanged fields so React can shallow-
 * compare and skip re-renders for untouched sub-trees.
 *
 * The `<T extends PageConfig>` generic lets hosts with stricter types pass
 * their own PageConfig in and get their own type back, while the SDK works
 * internally with the loose structural shape.
 */
// Monotonic counter for minting unique section ids. A timestamp alone collides
// when multiple add_section patches apply in the same millisecond (e.g. the
// agent adds two rows in one turn, or React batches both dispatches against the
// same pre-commit config) — the counter guarantees uniqueness regardless.
let addSectionSeq = 0;

export function applyPatch<T extends PageConfig>(
  config: T,
  patch: Patch,
  options?: ApplyPatchOptions,
): T {
  switch (patch.op) {
    case 'update_section': {
      const sections = config.sections.map((s) =>
        s.id === patch.sectionId
          ? { ...s, props: deepMerge(s.props, patch.patch) }
          : s,
      );
      return { ...config, sections };
    }
    case 'update_theme': {
      return {
        ...config,
        theme: deepMerge(config.theme, patch.patch),
      };
    }
    case 'set_filter': {
      return {
        ...config,
        filter: deepMerge(config.filter, patch.filter),
      };
    }
    case 'set_sort': {
      return {
        ...config,
        sort: deepMerge(config.sort, patch.sort),
      };
    }
    case 'remove_section': {
      return {
        ...config,
        sections: config.sections.filter((s) => s.id !== patch.sectionId),
      };
    }
    case 'reorder_sections': {
      const byId = new Map(config.sections.map((s) => [s.id, s] as const));
      const ordered = patch.order
        .map((id) => byId.get(id))
        .filter((s): s is Section => s !== undefined);
      // Don't lose sections not listed in the order — append at the end.
      const orderedIds = new Set(patch.order);
      const trailing = config.sections.filter((s) => !orderedIds.has(s.id));
      return { ...config, sections: [...ordered, ...trailing] };
    }
    case 'add_section': {
      // Mint a unique id: type + timestamp + a monotonic counter, then ensure
      // it doesn't collide with an existing section (belt-and-suspenders).
      const base = patch.sectionType.toLowerCase();
      const existing = new Set(config.sections.map((s) => s.id));
      let id = `${base}_${Date.now()}_${(addSectionSeq = (addSectionSeq + 1) % 0xffffff).toString(36)}`;
      while (existing.has(id)) {
        id = `${base}_${Date.now()}_${(addSectionSeq = (addSectionSeq + 1) % 0xffffff).toString(36)}`;
      }
      // Build a draft, optionally let the host validate / fill defaults.
      const draft: Section = {
        id,
        type: patch.sectionType,
        props: patch.props ?? {},
      };
      const newSection = options?.parseSection
        ? options.parseSection(draft)
        : draft;
      const sections = [...config.sections];
      if (patch.position.before) {
        const idx = sections.findIndex((s) => s.id === patch.position.before);
        sections.splice(idx >= 0 ? idx : sections.length, 0, newSection);
      } else if (patch.position.after) {
        const idx = sections.findIndex((s) => s.id === patch.position.after);
        sections.splice(idx >= 0 ? idx + 1 : sections.length, 0, newSection);
      } else if (typeof patch.position.index === 'number') {
        sections.splice(patch.position.index, 0, newSection);
      } else {
        sections.push(newSection);
      }
      return { ...config, sections };
    }
    default:
      return config;
  }
}

/** Convenience: fold an array of patches in order. */
export function applyPatches<T extends PageConfig>(
  base: T,
  patches: Patch[],
  options?: ApplyPatchOptions,
): T {
  return patches.reduce((cfg, p) => applyPatch(cfg, p, options), base);
}
