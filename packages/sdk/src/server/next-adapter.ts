// Thin Next.js wrapper around the universal chat handler.
//
// For Next App Router routes (app/api/.../route.ts), import this instead of
// createChatHandler directly. It returns the POST export Next expects and
// sets the runtime/dynamic exports needed for streaming responses.
//
// Usage:
//   import { createNextHandler } from '@showcase/sdk/next';
//   import { host } from '@/lib/personalization';
//   export const { POST, runtime, dynamic } = createNextHandler(host);

import type { HostConfig } from '../core/contract';
import { createChatHandler } from './chat-handler';

export interface NextHandlerExports {
  POST: (req: Request) => Promise<Response>;
  runtime: 'nodejs';
  dynamic: 'force-dynamic';
}

export function createNextHandler(host: HostConfig): NextHandlerExports {
  const handler = createChatHandler(host);
  return {
    POST: handler,
    runtime: 'nodejs',
    dynamic: 'force-dynamic',
  };
}
