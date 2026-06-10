import type { AnthropicTool, DefineHostInput } from '../contract';
import { buildRolePrompt } from './role';
import { buildSchemaCatalog } from './schema-catalog';
import { buildEditingRules } from './editing-rules';

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control: { type: 'ephemeral' };
}

export interface SystemBlocks {
  role: SystemBlock;
  schemaCatalog: SystemBlock;
  editingRules: SystemBlock;
}

/**
 * Build the 3 cacheable system segments Anthropic will see at the top of
 * every chat call. These are derived from host config + tool definitions
 * and should be cached across turns.
 */
export function buildSystemBlocks(
  host: DefineHostInput,
  toolDefinitions: AnthropicTool[],
): SystemBlocks {
  const role = buildRolePrompt(host);
  const schemaCatalog = buildSchemaCatalog(host);
  const editingRules = buildEditingRules(host);

  const toolsSummary = JSON.stringify(
    toolDefinitions.map((t) => ({ name: t.name, description: t.description })),
    null,
    2,
  );

  return {
    role: {
      type: 'text',
      text: role + '\n\n## Tools available\n' + toolsSummary,
      cache_control: { type: 'ephemeral' },
    },
    schemaCatalog: {
      type: 'text',
      text: schemaCatalog,
      cache_control: { type: 'ephemeral' },
    },
    editingRules: {
      type: 'text',
      text: editingRules,
      cache_control: { type: 'ephemeral' },
    },
  };
}

/**
 * Build the per-visitor state segment (NOT cacheable across visitors).
 * Goes at the end of the messages array, just before the user's message.
 */
export function buildVisitorState(snapshot: unknown, recentPatches: unknown[]): string {
  return `## Current page snapshot
${JSON.stringify(snapshot, null, 2)}

## Recent visitor preferences (most recent last)
${JSON.stringify(recentPatches, null, 2)}`;
}
