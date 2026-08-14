import { createNextHandler } from '@showcase/sdk/server';
import { host } from '@/lib/personalization';
import { fileLogger } from '@/lib/anthropic';
import { persistence } from '@/lib/modes';
import { makeBaseConfig } from '@/lib/base-config';

// The base config is static data held in code, so there is no DB round-trip
// and no fallback path to get wrong — `host.initialConfig` stays the
// client-safe stub, and the server swaps in the real thing here.
const serverHost = {
  ...host,
  logger: fileLogger,
  // Same shared instance the SSR loader and the reset route use, so every
  // reader and writer agrees on where state lives.
  persistence,
  initialConfig: makeBaseConfig(),
};

export const { POST, runtime, dynamic } = createNextHandler(serverHost);
