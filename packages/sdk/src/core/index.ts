// Server-safe barrel of the SDK's pure core.
//
// Everything under src/core/ is directive-free (no 'use client'), so this
// entry can be imported from React Server Components, route handlers, and
// schema modules that are evaluated on the server — unlike the root
// '@showcase/sdk' barrel, which bundles the client components (ChatPanel,
// PersonalizationRoot) and therefore carries a hoisted 'use client'.
//
// Import host theme schemas (defineTokens / defineFonts) and any other pure
// helper from here when the consuming module runs on the server. The root
// barrel re-exports these same symbols for client/SPA consumers.

// ─── patch model ────────────────────────────────────────────────────────
export { applyPatch, applyPatches } from './patch';
export type { Patch, PageConfig, Section, ApplyPatchOptions } from './patch';

// ─── host config ────────────────────────────────────────────────────────
export { defineHost } from './define-host';
export type {
  HostConfig,
  DefineHostInput,
  PersistenceAdapter,
  ChatTurn,
  Mode,
  SectionDefinition,
  PromptHints,
  AnthropicTool,
} from './contract';

// ─── logger ─────────────────────────────────────────────────────────────
export type { Logger, LogEntry } from './logger';
export { noopLogger, consoleLogger } from './logger';

// ─── anthropic ──────────────────────────────────────────────────────────
export {
  createAnthropicClient,
  estimateCost,
  MODEL_OPUS,
  MODEL_HAIKU,
  COST_PER_M,
} from './anthropic';
export type { CreateClientOptions, ClaudeUsage } from './anthropic';

// ─── tool defs ──────────────────────────────────────────────────────────
export { buildToolDefinitions } from './tool-defs';

// ─── theme tokens ───────────────────────────────────────────────────────
export {
  TokensSchema,
  defineTokens,
  DEFAULT_TOKENS,
  TOKEN,
  tokenKeyToCssVar,
} from './tokens';
export type { Tokens, TokenKey } from './tokens';

// ─── fonts ──────────────────────────────────────────────────────────────
export {
  defineFonts,
  buildFontStack,
  buildGoogleFontsUrl,
  DEFAULT_FONTS,
  LANG_FONT_URLS,
} from './fonts';
export type {
  FontEntry,
  FontCatalog,
  FontCategory,
  DefineFontsOptions,
} from './fonts';

// ─── card presets ───────────────────────────────────────────────────────
export {
  defineCardPresets,
  resolveCardPreset,
  aspectRatioCss,
  DEFAULT_CARD_PRESETS,
  CardLayoutSchema,
  SlotNodeSchema,
  OverlayNodeSchema,
  VIDEO_CARD_LAYOUT,
  SQUARE_CARD_LAYOUT,
  SHORTS_CARD_LAYOUT,
  COMPACT_CARD_LAYOUT,
  POSTER_CARD_LAYOUT,
  AUDIO_CARD_LAYOUT,
  HORIZONTAL_ROW_LAYOUT,
} from './cards';
export type {
  CardPreset,
  CardAspect,
  CardOrientation,
  HoverEffect,
  CardPresetCatalog,
  CardLayout,
  CoverNode,
  SlotNode,
  OverlayNode,
  OverlayPosition,
  DefineCardPresetsOptions,
} from './cards';

// ─── layout presets ─────────────────────────────────────────────────────
export {
  defineLayoutPresets,
  resolveLayoutPreset,
  DEFAULT_LAYOUT_PRESETS,
} from './layouts';
export type {
  LayoutKind,
  LayoutPreset,
  LayoutPresetCatalog,
  DefineLayoutPresetsOptions,
} from './layouts';

// ─── captions / subtitles ───────────────────────────────────────────────
export { translateCues, translateCuesTokenized } from './captions';
export type { CaptionCue, CaptionTrack, CaptionToken, TranslateCuesOptions } from './captions';

// ─── source rules (curated, scheduled content) ──────────────────────────
export {
  SourceRuleSchema,
  SourceScheduleSchema,
  sourceRulesField,
  isScheduleActiveNow,
  activeSourceRules,
  ruleTerms,
} from './source-rules';
export type { SourceRule, SourceSchedule } from './source-rules';

// ─── validation ─────────────────────────────────────────────────────────
export { validateBaseConfig } from './validate';
export type { ValidateResult } from './validate';

// ─── prompts ────────────────────────────────────────────────────────────
export { buildSystemBlocks, buildVisitorState } from './prompts/system';
export { buildRolePrompt } from './prompts/role';
export { buildSchemaCatalog } from './prompts/schema-catalog';
export { buildEditingRules } from './prompts/editing-rules';
export type { SystemBlock, SystemBlocks } from './prompts/system';
