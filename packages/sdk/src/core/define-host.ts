import type { DefineHostInput, HostConfig, Logger } from './contract';
import { createAnthropicClient } from './anthropic';
import { buildToolDefinitions } from './tool-defs';
import { buildRolePrompt } from './prompts/role';
import { buildSchemaCatalog } from './prompts/schema-catalog';
import { buildEditingRules } from './prompts/editing-rules';


const defaultLogger: Logger = { log() {} };
const DEFAULT_MODEL = 'claude-opus-4-7';
export function defineHost(input: DefineHostInput): HostConfig {
  // Derive once at call time. These don't depend on per-visitor state,
  // so doing the work once is enough — the chat handler reuses the
  // returned strings across every chat turn.
  const toolDefinitions = buildToolDefinitions(input);
  const rolePrompt = buildRolePrompt(input);
  const schemaCatalogPrompt = buildSchemaCatalog(input);
  const editingRulesPrompt = buildEditingRules(input);

  return {
    // ─── Passthrough (unchanged) ───
    promptHints: input.promptHints,
    persistence: input.persistence,
    logger: input.logger ?? defaultLogger,
    initialConfig: input.initialConfig,
    sections: input.sections,
    themeSchema: input.theme.schema,
    model: input.model ?? DEFAULT_MODEL,

    // ─── Derived (now real) ───
    toolDefinitions,
    rolePrompt,
    schemaCatalogPrompt,
    editingRulesPrompt,

    // ─── Lazy Anthropic client — real implementation ───
    getClient() {
      return createAnthropicClient({ apiKey: input.apiKey });
    },
  };
}

