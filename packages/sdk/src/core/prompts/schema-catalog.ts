import type { DefineHostInput } from '../contract';

export function buildSchemaCatalog(host: DefineHostInput): string {
  const lines = [
    '## Section type catalog',
    '',
    'Every section in the page has shape `{ id: string, type: <one of below>, props: <type-specific> }`. Use `update_section` to edit props by id; `add_section` with a registered type to inject; `remove_section` / `reorder_sections` for layout. Field shapes are documented in each tool\'s `input_schema`.',
    '',
  ];

  for (const [name, def] of Object.entries(host.sections)) {
    lines.push(`### ${name}`);
    if (def.description) lines.push(def.description);
    lines.push('');
  }

  return lines.join('\n');
}
