import { defineHost } from '@showcase/sdk';
import { supabasePersistence } from '@showcase/sdk/supabase';
import { initialConfig, promptHints, sections, ThemeSchema } from '../src/personalization/schemas';
import { supabaseAdmin } from './supabase';

/**
 * Server-side host.
 *
 * Shape (schemas, initialConfig, prompts) comes from ../src/personalization/schemas
 * — single source of truth shared with the client. Only the bits that
 * differ live here:
 *   - `persistence`: Supabase (server-only — service-role key)
 *   - `apiKey`: from env (Anthropic key, never sent to the browser)
 */
export const host = defineHost({
  theme: { schema: ThemeSchema },
  sections,
  initialConfig,
  promptHints,
  persistence: supabasePersistence(supabaseAdmin()),
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});
