import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Docker image na vlastním serveru — standalone vyrobí .next/standalone
  // se server.js a jen nutnými node_modules. Vercel toto pole ignoruje.
  output: 'standalone',

  // BEZ tohohle si Next kořen odvodí z nejbližšího nadřazeného lockfilu.
  // V git worktree (a v každé složce s package.json o úroveň výš) pak
  // server.js skončí zanořený a Dockerfile ho na čekaném místě nenajde.
  outputFileTracingRoot: path.resolve(__dirname),

  serverExternalPackages: ['@prisma/client'],
}

export default nextConfig
