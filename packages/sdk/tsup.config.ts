import { defineConfig } from 'tsup';
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // Server-safe pure-core barrel (no 'use client'). Imported by host schema
    // modules that are evaluated in RSC / server contexts.
    core: 'src/core/index.ts',
    // Server-only request handlers (also directive-free). Imported by Next.js
    // route handlers instead of the root barrel.
    server: 'src/server/index.ts',
    supabase: 'src/client/persistence/supabase.ts',
  },
  format: ['cjs', 'esm'],          // emit both — exports field picks based on consumer
  dts: {
    compilerOptions: { incremental: false },
  },
  sourcemap: true,
  // Don't wipe dist/ between builds — `build:css` runs after tsup, and any
  // window where `dist/styles.css` doesn't exist breaks CRA's exports
  // resolution mid-watch. Use `pnpm clean` explicitly if you want a fresh dir.
  clean: false,
  splitting: false,                 // one file per entry — easier to reason about
  // Keep 'use client' / 'use server' from source files (chat-panel, etc.) in
  // the bundled output so Next.js still recognizes client boundaries.
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
  // External deps: don't bundle, let the consumer's bundler resolve them.
  external: [
    'react',
    'react-dom',
    'zod',
    'zod-to-json-schema',
    '@anthropic-ai/sdk',
    '@supabase/supabase-js',
  ],
});
