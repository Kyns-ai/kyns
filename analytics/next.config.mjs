/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: ['mongodb', 'jose'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep mongodb as external on server — don't bundle it
      const externalsFn = (ctx, cb) => {
        if (ctx.request && ctx.request.startsWith('mongodb')) {
          return cb(null, `commonjs ${ctx.request}`)
        }
        cb()
      }
      if (Array.isArray(config.externals)) {
        config.externals.push(externalsFn)
      } else {
        config.externals = [config.externals, externalsFn].filter(Boolean)
      }
    } else {
      // Client bundle: ignore any server-only modules entirely
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, net: false, tls: false, dns: false, 'fs/promises': false,
        child_process: false, stream: false, crypto: false, http: false,
        https: false, zlib: false, path: false, os: false, util: false,
        url: false, assert: false, buffer: false, events: false,
      }
    }
    return config
  },
}

export default nextConfig
