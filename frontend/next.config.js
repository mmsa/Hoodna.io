/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared packages are linked from outside the Next.js app directory.
  // Transpile them and resolve their runtime dependencies from this app so
  // Vercel's frontend-only install can bundle them reliably.
  transpilePackages: ['@hoodna/shared', '@hoodna/tokens'],
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      zod: require.resolve('zod'),
    }
    return config
  },
  headers: async () => [
    {
      source: '/.well-known/apple-app-site-association',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    },
  ],
  // Enable standalone output for Docker optimization
  output: 'standalone',
}

module.exports = nextConfig

