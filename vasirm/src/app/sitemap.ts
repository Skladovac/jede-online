import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PUBLIC_STATUSES } from '@/lib/listings'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

const PAGES = ['', '/nabidka', '/prodej-nemovitosti', '/koupe-nemovitosti', '/odhad-nemovitosti-zdarma', '/o-nas', '/kontakt', '/ochrana-osobnich-udaju']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await prisma.listing.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    select: { slug: true, updatedAt: true, status: true },
  })
  return [
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...listings.map((l) => ({
      url: `${SITE_URL}/nabidka/${l.slug}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: l.status === 'SOLD' ? 0.3 : 0.8,
    })),
  ]
}
