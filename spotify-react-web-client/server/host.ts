import { defineHost } from '@showcase/sdk';
import { sqlitePersistence } from '@showcase/sdk/sqlite';
import { initialConfig, promptHints, sections, ThemeSchema } from '../src/personalization/schemas';

/**
 * Server-side host.
 *
 * Shape (schemas, initialConfig, prompts) comes from ../src/personalization/schemas
 * — single source of truth shared with the client. Only the bits that
 * differ live here:
 *   - `persistence`: local SQLite on the server's disk (see issues/009)
 *   - `apiKey`: from env (Anthropic key, never sent to the browser)
 */
export const host = defineHost({
  theme: { schema: ThemeSchema },
  sections,
  initialConfig,
  promptHints,
  // Explicit path: this server runs from spotify-react-web-client/, so an
  // implicit process.cwd() default would silently differ from apps/web's store.
  persistence: sqlitePersistence('.showcase/spotify.db'),
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});
