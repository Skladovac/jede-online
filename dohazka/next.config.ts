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

  // pdfkit nesmí projít webpackem: `new PDFDocument()` si sáhne pro Helveticu přes
  // vnitřní odkaz `#standard-fonts/Helvetica`, který se skládá za běhu, takže ho
  // bundler nerozmotá a export do PDF spadne až na serveru na MODULE_NOT_FOUND.
  serverExternalPackages: ['@prisma/client', 'pdfkit'],

  // Trasování závislostí tu vnitřní mapu `imports` nesleduje a zkopírovalo by z pdfkitu
  // jen tři soubory (bez `js/standard-fonts/`, `lib/fs/` a `lib/zlib/`). Proto ho
  // do standalone balíme celý.
  outputFileTracingIncludes: {
    '/api/export/[format]': ['./node_modules/pdfkit/**/*'],
  },
}

export default nextConfig
