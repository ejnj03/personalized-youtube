// Server-only request handlers, as their own entry so consumers (Next.js
// route handlers) don't import them through the root '@showcase/sdk' barrel —
// that barrel bundles the client components and carries a hoisted 'use client',
// which makes calling createNextHandler() at module load throw "called from the
// server". Everything under src/server/ is directive-free and depends only on
// the pure core, so this entry is safe to evaluate on the server.

export { createChatHandler } from './chat-handler';
export { createNextHandler } from './next-adapter';
export type { NextHandlerExports } from './next-adapter';
