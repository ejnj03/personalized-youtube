/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@showcase/shared', '@showcase/sdk'],
  // better-sqlite3 ships a native .node binary. Without this, webpack tries to
  // bundle it and every require fails at runtime with ERR_DLOPEN_FAILED —
  // which silently broke lib/innertube/chrome-cookies.ts (its failure is
  // swallowed by a try/catch, so YouTube fell back to unauthenticated requests
  // and timed out) long before lib/persistence/sqlite.ts existed.
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
    ],
  },
};

export default nextConfig;
