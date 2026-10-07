import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Docker image na vlastním serveru — standalone vyrobí .next/standalone se server.js.
  output: 'standalone',

  // Bez tohohle si Next kořen odvodí z nadřazeného lockfilu (kořen repa jede-online)
  // a server.js skončí zanořený, kde ho Dockerfile nenajde.
  outputFileTracingRoot: path.resolve(__dirname),

  serverExternalPackages: ['@prisma/client'],

  images: {
    // Obrázky karet se neukládají u nás, berou se z CDN zdroje katalogu.
    remotePatterns: [{ protocol: 'https', hostname: 'assets.tcgdex.net' }],
  },
}

export default nextConfig
