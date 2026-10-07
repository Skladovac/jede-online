import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const select = {
  id: true,
  name: true,
  localId: true,
  imageUrl: true,
  priceEur: true,
  rarity: true,
  set: { select: { name: true, code: true, officialCount: true } },
} satisfies Prisma.CardSelect

export type SearchHit = Prisma.CardGetPayload<{ select: typeof select }>

/** Zapečetěné produkty podle názvu (všechna slova musí sedět, "prismatic etb" najde ETB). */
export async function searchProducts(raw: string, limit = 6) {
  const words = raw.trim().replace(/\s+/g, ' ').slice(0, 60).split(' ').filter((w) => w.length >= 2)
  if (!words.length) return []
  // "etb" a "bb" jako zkratky, které lidé píšou
  const expand = (w: string) =>
    w.toLowerCase() === 'etb' ? 'Elite Trainer Box' : w.toLowerCase() === 'bb' ? 'Booster Bundle' : w
  return prisma.product.findMany({
    where: { AND: words.map((w) => ({ name: { contains: expand(w), mode: 'insensitive' as const } })) },
    select: { id: true, name: true, kind: true, imageUrl: true, priceEur: true, set: { select: { logoUrl: true } } },
    orderBy: [{ imageUrl: { sort: 'asc', nulls: 'last' } }, { addedAt: { sort: 'desc', nulls: 'last' } }],
    take: limit,
  })
}

const newestFirst = { set: { releaseDate: { sort: 'desc', nulls: 'last' } } } as const

// "45" najde i "045" a "0045" — na kartách jsou čísla s nulami různě dlouhá.
function localIdVariants(n: string) {
  const bare = n.replace(/^0+(?=\d)/, '')
  return [...new Set([n, bare, bare.padStart(2, '0'), bare.padStart(3, '0')])]
}

/**
 * Hledání karty tak, jak ji člověk vidí v ruce:
 *  - podle jména: "charizard", "pikachu ex"
 *  - podle kódu sady a čísla: "SVI 045", "svi045"
 *  - podle čísla z karty: "045/198"
 */
export async function searchCards(raw: string, limit = 12): Promise<SearchHit[]> {
  const q = raw.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (q.length < 2) return []

  const slash = q.match(/^([A-Za-z]*\d+[A-Za-z]*)\s*\/\s*(\d+)$/)
  if (slash) {
    return prisma.card.findMany({
      where: { localId: { in: localIdVariants(slash[1]) }, set: { officialCount: Math.min(Number(slash[2]), 100_000) } },
      select,
      orderBy: newestFirst,
      take: limit,
    })
  }

  const code = q.match(/^([A-Za-z][A-Za-z0-9]{1,5})\s?(\d{1,3}[A-Za-z]?)$/)
  if (code) {
    const hits = await prisma.card.findMany({
      where: {
        localId: { in: localIdVariants(code[2]) },
        set: { code: { equals: code[1], mode: 'insensitive' } },
      },
      select,
      orderBy: newestFirst,
      take: limit,
    })
    if (hits.length) return hits // jinak to byl třeba "Mew 2" — zkusíme jméno
  }

  // Nejdřív jména, která dotazem začínají, pak ta, která ho obsahují.
  const starts = await prisma.card.findMany({
    where: { name: { startsWith: q, mode: 'insensitive' } },
    select,
    orderBy: newestFirst,
    take: limit,
  })
  if (starts.length >= limit) return starts
  const contains = await prisma.card.findMany({
    where: { name: { contains: q, mode: 'insensitive' }, id: { notIn: starts.map((c) => c.id) } },
    select,
    orderBy: newestFirst,
    take: limit - starts.length,
  })
  return [...starts, ...contains]
}
