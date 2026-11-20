import type { MetadataRoute } from 'next'
import { ALLOW_INDEXING, SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  // Pracovní verze (jede.online) se nesmí dostat do vyhledávačů jako duplikát budoucí vasirm.cz.
  if (!ALLOW_INDEXING) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
