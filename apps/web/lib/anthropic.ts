import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  createAnthropicClient,
  MODEL_OPUS,
  MODEL_HAIKU,
  estimateCost,
  type Logger,
  type LogEntry,
} from '@showcase/sdk/core';

// Host's actual Anthropic client — built using the host's apiKey from env.
export const anthropic = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// YT clone's host-specific logger: append to JSONL on disk.
const LOG_PATH = process.cwd() + '/../../logs/anthropic.jsonl';

export const fileLogger: Logger = {
  async log(entry: LogEntry) {
    try {
      await mkdir(dirname(LOG_PATH), { recursive: true });
      await appendFile(LOG_PATH, JSON.stringify(entry) + '\n');
    } catch {
      // best-effort
    }
  },
};

// Back-compat: existing call sites do `import { appendLog } from '@/lib/anthropic'`.
// Keep this so route.ts and others don't need to change.
export const appendLog = (entry: LogEntry) => fileLogger.log(entry);

// Re-exports — anything in the YT clone that imports `MODEL_OPUS`, `estimateCost`,
// or the `LogEntry` type from `@/lib/anthropic` keeps working.
export { MODEL_OPUS, MODEL_HAIKU, estimateCost };
export type { LogEntry };
