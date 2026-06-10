import { defineHost, localStoragePersistence } from '@showcase/sdk';
import { initialConfig, promptHints, sections, ThemeSchema } from './schemas';

// Re-export the theme type so consumers (HomePageContainer, etc.) can keep
// importing from '../../../personalization/host' without churn.
export type { SpotifyTheme } from './schemas';

/**
 * Client-side host.
 *
 * Shape (schemas, initialConfig, prompts) comes from ./schemas — shared with
 * the server. Only the bits that genuinely differ live here:
 *   - `persistence`: localStorage (no-op on the server; the server has its
 *     own supabasePersistence)
 *   - `apiKey`: empty in the browser; the Hono backend reads it from env
 */
export const host = defineHost({
  theme: { schema: ThemeSchema },
  sections,
  initialConfig,
  promptHints,
  persistence: localStoragePersistence({ namespace: 'spotify' }),
  apiKey: '',
});
