import type { DefineHostInput } from '../contract';

const BASE_RULES = `## Editing rules

1. Patches are the smallest meaningful change. Don't replace the entire props of a section when one field changes — \`update_section({ sectionId, patch: { density: 'compact' } })\`.

2. Multiple tool calls per turn are fine and encouraged when the visitor's request decomposes naturally.

3. Stable section ids. Read them from the current-page snapshot at the bottom of the system message. Never invent ids.

4. Aesthetic vs behavioral edits:
   - Aesthetics → \`update_theme\` or \`update_section\` on visual props.
   - Layout → \`add_section\`, \`remove_section\`, \`reorder_sections\`, or \`update_section\` on density/columns.
   - Content fetching → \`request_more_content\`.

5. Reset is handled by the UI Reset button — don't try to reset via tool calls.

6. \`ask_user\` is a last resort. Pick the most likely interpretation rather than asking when the change is cheap to undo.

7. Discriminated unions — when switching the \`kind\`, \`type\`, or \`variant\` field of a nested object, ALWAYS null out fields that are only meaningful for the OLD variant. Patches deep-merge; stale fields from the previous variant survive otherwise and break rendering.

   Example: switching \`background\` from a gradient to a solid color.
   ❌ \`update_theme({ background: { kind: 'solid', from: '#FF7A1A', intensity: 0.8 } })\`
      — leaves stale \`to\` and \`angle\` from the gradient; renderer still draws the gradient.
   ✅ \`update_theme({ background: { kind: 'solid', from: '#FF7A1A', intensity: 0.8, to: null, angle: null } })\`
      — \`null\` removes the key entirely, so the resulting background is purely solid.

   Apply the same pattern for any discriminated union: when you set a \`kind\`/\`type\`/\`variant\` that's different from the current one, explicitly null out fields specific to the previous variant.`;

export function buildEditingRules(host: DefineHostInput): string {
  const examples = host.promptHints.examples ?? [];
  if (examples.length === 0) return BASE_RULES;

  const examplesBlock =
    '\n\n## Examples of valid edits\n' +
    examples.map((e) => `- ${e}`).join('\n');

  return BASE_RULES + examplesBlock;
}
