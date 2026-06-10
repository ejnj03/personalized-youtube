// Validate a candidate base PageConfig against a host's declared schemas.
//
// Use in seed scripts before writing to persistence — catches mis-shaped
// configs at seed time rather than at chat time (when an invalid config
// produces confusing Claude responses or render errors).

import type { HostConfig } from './contract';
import type { PageConfig } from './patch';

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

/**
 * Run a candidate PageConfig through the host's theme schema and each
 * section's prop schema.
 *
 * Reports:
 *   - Theme mismatches against host.themeSchema
 *   - Unknown section types (not in host.sections registry)
 *   - Section prop mismatches against host.sections[type].schema
 *
 * Does NOT throw — returns { valid, errors[] } so callers can choose to
 * fail loudly, log warnings, or continue.
 *
 * @example
 *   const { valid, errors } = validateBaseConfig(host, candidate);
 *   if (!valid) {
 *     console.error('seed validation failed:\n' + errors.map(e => '  - ' + e).join('\n'));
 *     process.exit(1);
 *   }
 *   await setSupabaseBaseConfig(client, slug, candidate);
 */
export function validateBaseConfig(
  host: HostConfig,
  config: PageConfig,
): ValidateResult {
  const errors: string[] = [];

  // Theme
  const themeResult = host.themeSchema.safeParse(config.theme);
  if (!themeResult.success) {
    errors.push(`theme: ${themeResult.error.message}`);
  }

  // Sections
  for (const section of config.sections) {
    const def = host.sections[section.type];
    if (!def) {
      errors.push(
        `unknown section type "${section.type}" at id="${section.id}" — not registered in host.sections`,
      );
      continue;
    }
    const result = def.schema.safeParse(section.props);
    if (!result.success) {
      errors.push(
        `section id="${section.id}" type="${section.type}": ${result.error.message}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
