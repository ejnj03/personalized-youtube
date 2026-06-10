// Public API of the personalization SDK.
//
// Internal layout (see folders):
//   core/    — universal: types, patch model, prompt builders, Anthropic wrapper
//   client/  — React components (browser)
//   server/  — request handlers (server-only)

// ─── core / patch model ─────────────────────────────────────────────────
export { applyPatch, applyPatches } from './core/patch';
export type {
  Patch,
  PageConfig,
  Section,
  ApplyPatchOptions,
} from './core/patch';

// ─── core / host config ─────────────────────────────────────────────────
export { defineHost } from './core/define-host';
export type {
  HostConfig,
  DefineHostInput,
  PersistenceAdapter,
  ChatTurn,
  Mode,
  SectionDefinition,
  PromptHints,
  AnthropicTool,
} from './core/contract';

// ─── core / logger ──────────────────────────────────────────────────────
export type { Logger, LogEntry } from './core/logger';
export { noopLogger, consoleLogger } from './core/logger';

// ─── core / anthropic ───────────────────────────────────────────────────
export {
  createAnthropicClient,
  estimateCost,
  MODEL_OPUS,
  MODEL_HAIKU,
  COST_PER_M,
} from './core/anthropic';
export type { CreateClientOptions, ClaudeUsage } from './core/anthropic';

// ─── core / tool defs ───────────────────────────────────────────────────
export { buildToolDefinitions } from './core/tool-defs';

// ─── core / theme tokens ────────────────────────────────────────────────
export {
  TokensSchema,
  defineTokens,
  DEFAULT_TOKENS,
  TOKEN,
  tokenKeyToCssVar,
} from './core/tokens';
export type { Tokens, TokenKey } from './core/tokens';

// ─── core / card + layout presets ───────────────────────────────────────
export {
  defineCardPresets,
  resolveCardPreset,
  aspectRatioCss,
  DEFAULT_CARD_PRESETS,
  defineLayoutPresets,
  resolveLayoutPreset,
  DEFAULT_LAYOUT_PRESETS,
} from './core';
export type {
  CardPreset,
  CardAspect,
  CardOrientation,
  HoverEffect,
  CardPresetCatalog,
  LayoutKind,
  LayoutPreset,
  LayoutPresetCatalog,
  CardLayout,
  CoverNode,
  SlotNode,
  OverlayNode,
  OverlayPosition,
} from './core';
// Card layout grammar (slot-tree) + schema for hosts that put cardLayout
// in their ThemeSchema.
export {
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
} from './core';

// ─── core / fonts ───────────────────────────────────────────────────────
export {
  defineFonts,
  buildFontStack,
  buildGoogleFontsUrl,
  DEFAULT_FONTS,
  LANG_FONT_URLS,
} from './core/fonts';
export type {
  FontEntry,
  FontCatalog,
  FontCategory,
  DefineFontsOptions,
} from './core/fonts';

// ─── core / validation ──────────────────────────────────────────────────
export { validateBaseConfig } from './core/validate';
export type { ValidateResult } from './core/validate';

// ─── core / prompts ─────────────────────────────────────────────────────
export { buildSystemBlocks, buildVisitorState } from './core/prompts/system';
export { buildRolePrompt } from './core/prompts/role';
export { buildSchemaCatalog } from './core/prompts/schema-catalog';
export { buildEditingRules } from './core/prompts/editing-rules';
export type { SystemBlock, SystemBlocks } from './core/prompts/system';

// ─── client / React components ──────────────────────────────────────────
export { ChatPanel, mentionInChat } from './client/chat-panel';
export type { ChatPanelProps } from './client/chat-panel';

export {
  PersonalizationRoot,
  usePersonalization,
  useConfig,
  useDispatch,
  useOptionalDispatch,
} from './client/personalization-root';
export type { PersonalizationRootProps } from './client/personalization-root';

export { PageRenderer } from './client/page-renderer';
export type { PageRendererProps } from './client/page-renderer';

// ─── media (host-agnostic card + collection primitives) ─────────────────
export { MediaCard, MediaCollection, MediaFeed, useSourceRules } from './client/media';
export type {
  MediaCardProps,
  MediaCollectionProps,
  MediaFeedProps,
  MediaFeedHandle,
  UseSourceRulesOptions,
  UseSourceRulesResult,
  MediaItem,
} from './client/media';

// ─── source rules (curated, scheduled content) — host-agnostic primitive ─
export {
  SourceRuleSchema,
  SourceScheduleSchema,
  sourceRulesField,
  isScheduleActiveNow,
  activeSourceRules,
  ruleTerms,
} from './core';
export type { SourceRule, SourceSchedule } from './core';

// ─── client / persistence adapters ──────────────────────────────────────
export { inMemoryPersistence } from './client/persistence/in-memory';
export { cookiePersistence } from './client/persistence/cookie';
export { localStoragePersistence } from './client/persistence/local-storage';
export type { CookiePersistenceOptions } from './client/persistence/cookie';
export type { LocalStoragePersistenceOptions } from './client/persistence/local-storage';

// ─── server / handlers ──────────────────────────────────────────────────
export { createChatHandler } from './server/chat-handler';
export { createNextHandler } from './server/next-adapter';
export type { NextHandlerExports } from './server/next-adapter';

