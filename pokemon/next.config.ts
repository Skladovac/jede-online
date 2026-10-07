import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Docker image na vlastním serveru — standalone vyrobí .next/standalone se server.js.
  output: 'standalone',

  // Bez tohohle si Next kořen odvodí z nadřazeného lockfilu (kořen repa jede-online)
  // a server.js skončí zanořený, kde ho Dockerfile nenajde.
  outputFileTracingRoot: path.resolve(__dirname),

  serverExternalPackages: ['@prisma/client'],

  // Obrázky karet: v produkci /img/ obsluhuje a kešuje nginx (viz deploy/nginx-…conf),
  // sem dojde jen lokální vývoj.
  async rewrites() {
    return [
      { source: '/img/:path*', destination: 'https://assets.tcgdex.net/:path*' },
      { source: '/img2/:path*', destination: 'https://images.pokemontcg.io/:path*' },
      { source: '/img3/:path*', destination: 'https://tcgplayer-cdn.tcgplayer.com/:path*' },
    ]
  },
}

export default nextConfig
