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
  // „CC025“ → prefix „CC“ + číslo „025“ (varianty 25, 025, CC25, CC025…)
  const m = /^([A-Za-z]*)(\d+)([A-Za-z]?)$/.exec(n)
  if (!m) return [n]
  const [, pfx, num, sfx] = m
  const bare = num.replace(/^0+(?=\d)/, '')
  const nums = [...new Set([num, bare, bare.padStart(2, '0'), bare.padStart(3, '0')])]
  const out = new Set<string>()
  for (const p of [pfx, pfx.toUpperCase()]) for (const x of nums) out.add(`${p}${x}${sfx}`)
  return [...out]
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
    const total = Math.min(Number(slash[2]), 100_000)
    const hits = await prisma.card.findMany({
      where: { localId: { in: localIdVariants(slash[1]) }, set: { officialCount: total } },
      select,
      orderBy: newestFirst,
      take: limit,
    })
    // Reprinty v Celebrations Classic Collection mají na kartě původní číslo (66/64), v katalogu CC010.
    const classic = CLASSIC_REPRINT[`${slash[1].replace(/^0+(?=\d)/, '')}/${total}`]
    if (classic) {
      const cc = await prisma.card.findMany({ where: { id: `cel25cc-${classic}` }, select })
      return [...cc, ...hits.filter((h) => !cc.some((c) => c.id === h.id))].slice(0, limit)
    }
    return hits
  }

  // Kód může začínat i číslicí ("30C 071") — pak je mezera povinná, ať se neplete s holým číslem.
  // Číslo může mít písmenný prefix ("CEL CC025", "SIT TG05", "CRZ GG01").
  const code = q.match(/^([A-Za-z][A-Za-z0-9]{1,5}?|\d[A-Za-z0-9]{1,5}(?=\s))\s?((?:[A-Za-z]{1,4})?\d{1,3}[A-Za-z]?)$/)
  if (code) {
    const hits = await prisma.card.findMany({
      where: {
        localId: { in: localIdVariants(code[2]) },
        // Podsady mají kód „CEL:CC“, „SIT:TG“ — stačí zadat hlavní část („CEL CC025“).
        set: { OR: [{ code: { equals: code[1], mode: 'insensitive' } }, { code: { startsWith: `${code[1]}:`, mode: 'insensitive' } }] },
      },
      select,
      orderBy: newestFirst,
      take: limit,
    })
    if (hits.length) return hits // jinak to byl třeba "Mew 2" — zkusíme jméno
  }

  // Samotné číslo s písmeny ("CC025", "TG05", "SV94") bez kódu sady — hledáme napříč sadami.
  const alnum = q.match(/^([A-Za-z]{1,4})(\d{1,3})$/)
  if (alnum) {
    const hits = await prisma.card.findMany({ where: { localId: { in: localIdVariants(q) } }, select, orderBy: newestFirst, take: limit })
    if (hits.length) return hits
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
  const found = [...starts, ...contains]
  if (found.length) return found
  // Bez apostrofu a teček („Rockets Zapdos“, „Rockets Admin“ → „Rocket's Zapdos“, „Rocket's Admin.“).
  const loose = q.replace(/['’.]/g, '').toLowerCase()
  if (loose.length < 2) return []
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Card" c JOIN "CardSet" s ON s.id = c."setId"
    WHERE lower(regexp_replace(c.name, '[''’.]', '', 'g')) LIKE ${`%${loose}%`}
    ORDER BY s."releaseDate" DESC NULLS LAST LIMIT ${limit}`
  if (!ids.length) return []
  const rows = await prisma.card.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select })
  return ids.map((r) => rows.find((c) => c.id === r.id)!).filter(Boolean)
}

/** Celebrations Classic Collection: původní číslo na kartě → číslo v katalogu (cel25cc-CC0xx). */
const CLASSIC_REPRINT: Record<string, string> = {
  '2/102': 'CC001', // Blastoise
  '4/102': 'CC002', // Charizard
  '15/102': 'CC003', // Venusaur
  '73/102': 'CC004', // Imposter Professor Oak
  '8/82': 'CC005', // Dark Gyarados
  '15/82': 'CC006', // Here Comes Team Rocket!
  '15/132': 'CC007', // Rocket's Zapdos
  '20/111': 'CC009', // Cleffa
  '66/64': 'CC010', // Shining Magikarp
  '9/95': 'CC011', // Team Magma's Groudon
  '86/109': 'CC012', // Rocket's Admin.
  '88/92': 'CC013', // Mew ex
  '93/101': 'CC014', // Gardevoir ex δ
  '17/17': 'CC015', // Umbreon ★
  '15/106': 'CC016', // Claydol
  '109/111': 'CC017', // Luxray GL LV.X
  '145/147': 'CC018', // Garchomp C LV.X
  '107/123': 'CC019', // Donphan
  '113/114': 'CC020', // Reshiram
  '114/114': 'CC021', // Zekrom
  '54/99': 'CC022', // Mewtwo EX
  '97/146': 'CC023', // Xerneas EX
  '76/108': 'CC024', // M Rayquaza EX
  '60/145': 'CC025', // Tapu Lele GX
}

/** Jedna karta ve stejném tvaru jako výsledky hledání. */
export async function searchCardsById(id: string): Promise<SearchHit[]> {
  return prisma.card.findMany({ where: { id }, select, take: 1 })
}
