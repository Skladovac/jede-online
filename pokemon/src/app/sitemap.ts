import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

// Mapa webu pro vyhledávače: /sitemap/0.xml = stránky, sady a produkty; /sitemap/1.xml… = karty po 20 000.
const BASE = 'https://pokemon.jede.online'
const CHUNK = 20_000

// Seznam souborů musí jít vytvořit už při sestavení (bez databáze): pevně 0–3 = až 60 000 karet; prázdný soubor nevadí.
export const dynamic = 'force-dynamic'

export function generateSitemaps() {
  return [0, 1, 2, 3].map((id) => ({ id }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  if (Number(id) === 0) {
    const [sets, products, auctions, profiles] = await Promise.all([
      prisma.cardSet.findMany({ where: { game: 'pokemon' }, select: { id: true, syncedAt: true } }),
      prisma.product.findMany({ select: { id: true, syncedAt: true } }),
      prisma.auction.findMany({
        where: { hiddenAt: null, user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      // Jen profily, které si dohledatelnost přes Google zapnuly (u dětí ji nastavuje rodič).
      prisma.user.findMany({
        where: { indexable: true, bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
        select: { nickname: true, lastSeenAt: true },
        take: 10000,
      }),
    ])
    const pages = ['', '/sady', '/sady?jazyk=ja', '/produkty', '/trziste', '/trziste?tab=koupim', '/aukce', '/hodnoceni', '/bezpecny-obchod', '/soukromi', '/registrace']
    return [
      ...pages.map((p) => ({ url: `${BASE}${p}`, changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.7 })),
      ...sets.map((s) => ({ url: `${BASE}/sady/${encodeURIComponent(s.id)}`, lastModified: s.syncedAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
      ...products.map((p) => ({ url: `${BASE}/produkt/${p.id}`, lastModified: p.syncedAt, changeFrequency: 'weekly' as const, priority: 0.5 })),
      ...auctions.map((a) => ({ url: `${BASE}/aukce/${a.id}`, lastModified: a.createdAt, changeFrequency: 'daily' as const, priority: 0.5 })),
      ...profiles.map((u) => ({ url: `${BASE}/@${encodeURIComponent(u.nickname)}`, lastModified: u.lastSeenAt ?? undefined, changeFrequency: 'weekly' as const, priority: 0.4 })),
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
