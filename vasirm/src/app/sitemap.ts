import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PUBLIC_STATUSES } from '@/lib/listings'
import { SHOW_LISTINGS, SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

const PAGES = ['', '/o-nas', '/nabidka', '/reference', '/prodej-nemovitosti', '/koupe-nemovitosti', '/co-dela-makler', '/odhad-nemovitosti-zdarma', '/kontakt', '/ochrana-osobnich-udaju']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = SHOW_LISTINGS
    ? await prisma.listing.findMany({
        where: { status: { in: PUBLIC_STATUSES } },
        select: { slug: true, updatedAt: true, status: true },
      })
    : []
  const agents = await prisma.user.findMany({ select: { slug: true } })
  return [
    ...agents.map((a) => ({ url: `${SITE_URL}/makleri/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.9 })),
    ...PAGES.filter((p) => SHOW_LISTINGS || p !== '/nabidka').map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...listings.map((l) => ({
      url: `${SITE_URL}/nabidka/${l.slug}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: l.status === 'SOLD' ? 0.3 : 0.8,
    })),
  ]
}
