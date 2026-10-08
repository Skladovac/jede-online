import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

// Mapa webu pro vyhledávače: /sitemap/0.xml = stránky, sady a produkty; /sitemap/1.xml… = karty po 20 000.
const BASE = 'https://pokemon.jede.online'
const CHUNK = 20_000

export const revalidate = 86400

export async function generateSitemaps() {
  const cards = await prisma.card.count()
  return Array.from({ length: 1 + Math.ceil(cards / CHUNK) }, (_, id) => ({ id }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  if (Number(id) === 0) {
    const [sets, products] = await Promise.all([
      prisma.cardSet.findMany({ where: { game: 'pokemon' }, select: { id: true, syncedAt: true } }),
      prisma.product.findMany({ select: { id: true, syncedAt: true } }),
    ])
    const pages = ['', '/sady', '/sady?jazyk=ja', '/produkty', '/trziste', '/hodnoceni', '/bezpecny-obchod', '/soukromi', '/registrace']
    return [
      ...pages.map((p) => ({ url: `${BASE}${p}`, changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.7 })),
      ...sets.map((s) => ({ url: `${BASE}/sady/${encodeURIComponent(s.id)}`, lastModified: s.syncedAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
      ...products.map((p) => ({ url: `${BASE}/produkt/${p.id}`, lastModified: p.syncedAt, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ]
  }
  const cards = await prisma.card.findMany({
    select: { id: true, syncedAt: true },
    orderBy: { id: 'asc' },
    skip: (Number(id) - 1) * CHUNK,
    take: CHUNK,
  })
  return cards.map((c) => ({ url: `${BASE}/karta/${encodeURIComponent(c.id)}`, lastModified: c.syncedAt, changeFrequency: 'weekly' as const, priority: 0.6 }))
}
