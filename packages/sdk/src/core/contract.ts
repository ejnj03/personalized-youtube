import type { ZodTypeAny } from 'zod';
import type { ComponentType } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import type { Patch, PageConfig } from './patch';
import type { Logger } from './logger';

// Re-export so consumers can still get the type from `@showcase/sdk` without
// caring which file it lives in. The canonical home is logger.ts.
export type { Logger, LogEntry } from './logger';

//injects domain context regarding the host (i.e., ("...for a YouTube clone" vs "...for a skate shop e-commerce store")
export interface PromptHints {
  /**
   * Brief description of the host that goes into the system prompt's role.
   * Example: "personalization assistant for a YouTube clone — feeds of
   * videos, channels, watch view; loose, video-fan vocabulary."
   */
  role: string;

  /**
   * Optional few-shot examples shown to Claude alongside the editing rules.
   * Each example is a (user prompt → tool call) pair as a human-readable
   * string. Helps Claude calibrate to host-specific conventions.
   */
  examples?: string[];

  /**
   * Optional override of the cacheable role segment header. Defaults to
   * the SDK's standard role text.
   */
  systemRole?: string;
}


//a single entry in the host's section registry: schema + component, paired
export interface SectionDefinition<TProps = Record<string, unknown>> {
  /**
   * Zod schema describing this section's props. Used for: validating tool
   * inputs at the API boundary, generating the prompt catalog, materializing
   * defaults on add_section.
   */
  schema: ZodTypeAny;

  /**
   * React component to render an instance of this section.
   * Receives the props described by `schema`.
   *
   * NOTE: typed loosely (`ComponentType<any>`) until Stage 8 — different
   * hosts use different prop conventions today (YT clone passes
   * { section, config }; commerce/Spotify pass schema-shaped props).
   * Stage 8's <PageRenderer> will pick a canonical convention and we'll
   * tighten this back to `ComponentType<TProps>`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;

  /**
   * Optional human-readable description shown to Claude in the schema
   * catalog. If omitted, just the section type name appears.
   */
  description?: string;
}

/**
 * One round-trip in the chat panel — the visitor's message plus the
 * assistant's response and the tool calls that response triggered.
 *
 * Persisted so the chat panel can hydrate its transcript on a fresh page
 * load (otherwise refreshing wipes the visible conversation, even though
 * the resulting page state — patches — is intact).
 */
export interface ChatTurn {
  userMessage: string;
  /** Empty string if the assistant only called tools and emitted no text. */
  assistantMessage: string;
  toolUses: Array<{ name: string }>;
  /** ISO 8601 timestamp. Set by the SDK; adapters store as-is. */
  createdAt: string;
}

/**
 * A named, isolated personalization session — its own config + chat history.
 * Visitors can have many; switching mode reloads the config and the chat
 * panel's transcript. Scoped per (visitor, site).
 */
export interface Mode {
  /** Server-minted UUID. */
  id: string;
  /** User-given name (e.g. "Focus", "Party"). */
  title: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

//slug is the page identifier — lets one adapter handle multiple "pages" of personalization
//modeId is the active save-slot for this visitor at this slug.
export interface PersistenceAdapter {
  /**
   * Load all patches recorded for this visitor at this slug+mode.
   * Returns them in chronological order so applyPatches() yields the
   * current state.
   *
   * On a fresh visitor / cleared storage, returns an empty array.
   */
  read(visitorId: string, slug: string, modeId: string): Promise<Patch[]>;

  /**
   * Append new patches to the visitor's history at this slug+mode.
   * Optimistic, fire-and-forget from the SDK's perspective — but adapters
   * SHOULD await actual storage so failures surface.
   */
  write(visitorId: string, slug: string, modeId: string, patches: Patch[]): Promise<void>;

  /**
   * Wipe all patches AND chat turns for this visitor at this slug+mode.
   * Used by the "Reset preferences" affordance.
   */
  reset(visitorId: string, slug: string, modeId: string): Promise<void>;

  /**
   * Append a chat turn to the visitor's transcript at this slug+mode.
   * Called by the SDK's chat handler at the end of every turn. Best-effort:
   * failures are swallowed by the handler so they don't break the response.
   */
  recordTurn(visitorId: string, slug: string, modeId: string, turn: ChatTurn): Promise<void>;

  /**
   * Read the visitor's recent chat turns in chronological order
   * (oldest → newest). `limit` caps how many to return; adapters should
   * default to a reasonable cap (~30) when omitted.
   *
   * Returns an empty array for fresh visitors / cleared storage.
   */
  readTurns(visitorId: string, slug: string, modeId: string, limit?: number): Promise<ChatTurn[]>;

  /**
   * List all modes for this visitor at this slug, oldest first (so the
   * first one created reads as the "default" pill).
   */
  listModes(visitorId: string, slug: string): Promise<Mode[]>;

  /**
   * Create a new mode with the given title. Returns the freshly-minted Mode.
   */
  createMode(visitorId: string, slug: string, title: string): Promise<Mode>;
}

//job: what host passes to defineHost
export interface DefineHostInput {
  /** The host's theme definition. */
  theme: {
    schema: ZodTypeAny;
  };

  /** Section type registry — keys are section type names, values are schema+component. */
  sections: Record<string, SectionDefinition>;

  /** Starting state of the page. Folded with persisted patches at render time. */
  initialConfig: PageConfig;

  /** Domain hints injected into Claude's system prompt. */
  promptHints: PromptHints;

  /** How preferences persist. */
  persistence: PersistenceAdapter;

  /** Where log entries go. Defaults to noopLogger if omitted. */
  logger?: Logger;

  /** Claude API key — read by the SDK from here, not from process.env. */
  apiKey: string;

  /** Optional model override. Defaults to Claude Opus. */
  model?: string;
}

//job: what defineHost() returns

/**
 * Result of defineHost(). Bundles together everything the rest of the SDK
 * needs to operate. The host doesn't construct or inspect this directly —
 * it just hands it to <PersonalizationRoot>, createChatHandler(), etc.
 */
export interface HostConfig {
  // ─── Passthrough from DefineHostInput ───
  promptHints: PromptHints;
  persistence: PersistenceAdapter;
  logger: Logger;
  initialConfig: PageConfig;
  sections: Record<string, SectionDefinition>;
  themeSchema: ZodTypeAny;
  model: string;

  // ─── Derived at defineHost() time ───
  /** JSON Schema array for Anthropic tools, derived from theme + section schemas. */
  toolDefinitions: AnthropicTool[];

  /** Cacheable prompt segment listing what's editable. Derived from schemas. */
  schemaCatalogPrompt: string;

  /** Cacheable prompt segment with editing rules + examples. Derived from PromptHints. */
  editingRulesPrompt: string;

  /** Cacheable prompt segment with role + system tone. Derived from PromptHints. */
  rolePrompt: string;

  /** Lazy Anthropic client factory. Holds the apiKey closed over. */
  getClient(): Anthropic;
}

// Tool definition shape Anthropic expects — match their SDK's type
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: object;
}
