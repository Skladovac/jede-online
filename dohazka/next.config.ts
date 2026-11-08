import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Neprozrazovat, na čem web běží (hlavička X-Powered-By).
  poweredByHeader: false,
  // Docker image na vlastním serveru — standalone vyrobí .next/standalone se server.js.
  output: 'standalone',

  // Bez tohohle si Next kořen odvodí z nadřazeného lockfilu (kořen repa jede-online)
  // a server.js skončí zanořený, kde ho Dockerfile nenajde.
  outputFileTracingRoot: path.resolve(__dirname),

  serverExternalPackages: ['@prisma/client'],
}

export default nextConfig
