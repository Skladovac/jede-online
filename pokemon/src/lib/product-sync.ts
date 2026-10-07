import { Prisma, type ProductKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pickStats } from '@/lib/price-stats'

/**
 * Katalog zapečetěných produktů z veřejných souborů Cardmarketu (název, typ, rozšíření, ceny v EUR)
 * a obrázky z TCGplayeru přes tcgcsv.com (spárované podle názvu v rámci sady).
 */

const CM = 'https://downloads.s3.cardmarket.com/productCatalog'
const TCGCSV = 'https://tcgcsv.com/tcgplayer/3' // 3 = Pokémon

const KIND: Record<string, ProductKind> = {
  'Pokémon Booster': 'BOOSTER',
  'Pokémon Display': 'DISPLAY',
  'Pokémon Elite Trainer Boxes': 'ETB',
  'Pokémon Tins': 'TIN',
  'Pokémon Blisters': 'BLISTER',
  'Pokémon Box Set': 'BOX_SET',
  'Pokémon Theme Decks': 'THEME_DECK',
  'Pokémon Trainer Kits': 'TRAINER_KIT',
  'Pokémon Coins': 'COIN',
}
// "Lot" = balíky náhodných věcí, ne konkrétní zapečetěný produkt.
const SKIP = new Set(['Pokémon Lot'])

type CmProduct = { idProduct: number; name: string; categoryName: string; idExpansion: number; dateAdded: string }
type CmPrice = {
  idProduct: number
  avg?: number | null
  low?: number | null
  trend?: number | null
  avg1?: number | null
  avg7?: number | null
  avg30?: number | null
}
type TcgGroup = { groupId: number; name: string }
type TcgProduct = { productId: number; name: string; extendedData?: { name: string }[] }

async function getJson<T>(url: string): Promise<T> {
  // tcgcsv.com bez User-Agent vrací 401.
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
    headers: { 'User-Agent': 'pokemon.jede.online catalog sync (pokemon@jede.online)' },
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return (await res.json()) as T
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const STOP = new Set(['pokemon', 'the', 'of', 'and', 'tcg', 'pack', 'exclusive', 'a', 'x'])
const tokens = (s: string, drop: Set<string>) =>
  new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t) && !drop.has(t)))

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

const price = (p?: CmPrice) => {
  // Stejně jako u karet: trend, pak krátkodobé průměry; `avg` až nakonec.
  const v = [p?.trend, p?.avg7, p?.avg30, p?.avg].find((x) => x && x > 0)
  return v ? new Prisma.Decimal(v.toFixed(2)) : null
}

export async function syncProducts(log: (m: string) => void = console.log) {
  const [{ products }, { priceGuides }, sets] = await Promise.all([
    getJson<{ products: CmProduct[] }>(`${CM}/productList/products_nonsingles_6.json`),
    getJson<{ priceGuides: CmPrice[] }>(`${CM}/priceGuide/price_guide_6.json`),
    prisma.cardSet.findMany({ where: { game: 'pokemon' }, select: { id: true, name: true } }),
  ])
  const prices = new Map(priceGuides.map((p) => [p.idProduct, p]))
  const list = products.filter((p) => !SKIP.has(p.categoryName))

  // Rozšíření Cardmarketu → naše sada. Každý produkt hlasuje sadou, jejímž názvem začíná.
  // Celé rozšíření se přiřadí jen při jasné většině (smíšené skupiny typu "Box Sets" by jinak
  // spadly celé pod jednu náhodnou sadu); jinak se páruje každý produkt zvlášť.
  const setNames = sets.map((s) => ({ id: s.id, n: norm(s.name) })).sort((a, b) => b.n.length - a.n.length)
  const prefixSet = (name: string) => {
    const n = norm(name)
    return setNames.find((s) => n === s.n || n.startsWith(s.n + ' '))?.id
  }
  const votes = new Map<number, { total: number; by: Map<string, number> }>()
  for (const p of list) {
    const v = votes.get(p.idExpansion) ?? { total: 0, by: new Map<string, number>() }
    v.total++
    const hit = prefixSet(p.name)
    if (hit) v.by.set(hit, (v.by.get(hit) ?? 0) + 1)
    votes.set(p.idExpansion, v)
  }
  const expansionSet = new Map<number, string>()
  for (const [exp, v] of votes) {
    const top = [...v.by.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] >= 2 && top[1] / v.total >= 0.5) expansionSet.set(exp, top[0])
  }
  const setFor = (p: CmProduct) => expansionSet.get(p.idExpansion) ?? prefixSet(p.name) ?? null

  const now = new Date()
  for (let i = 0; i < list.length; i += 200) {
    await prisma.$transaction(
      list.slice(i, i + 200).map((p) => {
        const data = {
          name: p.name,
          kind: KIND[p.categoryName] ?? 'OTHER',
          cmExpansionId: p.idExpansion,
          setId: setFor(p),
          priceEur: price(prices.get(p.idProduct)),
          priceStats: pickStats(prices.get(p.idProduct) as unknown as Record<string, number | null>) ?? Prisma.JsonNull,
          priceUpdatedAt: now,
          addedAt: p.dateAdded ? new Date(p.dateAdded.replace(' ', 'T') + 'Z') : null,
        }
        return prisma.product.upsert({ where: { id: p.idProduct }, create: { id: p.idProduct, ...data }, update: data })
      }),
    )
  }
  log(`[produkty] ${list.length} produktů, ${[...expansionSet.keys()].length} rozšíření spárováno se sadami`)

  try {
    await fillProductImages(log)
  } catch (err) {
    log(`[produkty] obrázky selhaly: ${(err as Error).message}`)
  }
}

/**
 * Obrázky z TCGplayeru (přes tcgcsv.com) pro produkty bez obrázku, každý nejvýš 1× za 30 dní.
 * Nejdřív se hledá v odpovídající sadě TCGplayeru, pak v celém katalogu zapečetěných produktů.
 */
export async function fillProductImages(log: (m: string) => void) {
  const missing = await prisma.product.findMany({
    where: {
      imageUrl: null,
      OR: [{ imageCheckedAt: null }, { imageCheckedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } }],
    },
    select: { id: true, name: true, set: { select: { name: true } } },
  })
  if (!missing.length) return

  const groups = (await getJson<{ results: TcgGroup[] }>(`${TCGCSV}/groups`)).results
  const strip = (n: string) => n.replace(/^[A-Za-z0-9.]+:\s*/, '') // "SV: Prismatic Evolutions"
  const groupByName = new Map(groups.map((g) => [norm(strip(g.name)), g]))

  // Zapečetěné produkty všech skupin (jednotlivé karty mají v extendedData "Number").
  type Cand = { id: number; group: number; tokFull: Set<string>; name: string }
  const cands: Cand[] = []
  let i = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < groups.length) {
        const g = groups[i++]
        try {
          const all = (await getJson<{ results: TcgProduct[] }>(`${TCGCSV}/${g.groupId}/products`)).results
          for (const p of all)
            if (!(p.extendedData ?? []).some((e) => e.name === 'Number'))
              cands.push({ id: p.productId, group: g.groupId, name: p.name, tokFull: tokens(`${strip(g.name)} ${p.name}`, new Set()) })
        } catch {
          /* jedna skupina nevadí */
        }
      }
    }),
  )

  const pick = (scored: { id: number; s: number }[], min: number) => {
    scored.sort((a, b) => b.s - a.s)
    const [best, second] = scored
    // Jen jisté shody: vysoká podobnost a jednoznačný vítěz.
    return best && best.s >= min && (!second || second.s < best.s) ? best.id : null
  }

  let found = 0
  const now = new Date()
  for (const p of missing) {
    let hit: number | null = null
    const group = p.set ? groupByName.get(norm(p.set.name)) : undefined
    if (group) {
      const drop = tokens(p.set!.name, new Set())
      const mine = tokens(p.name, drop)
      hit = pick(
        cands.filter((c) => c.group === group.groupId).map((c) => ({ id: c.id, s: similarity(mine, tokens(c.name, drop)) })),
        0.75,
      )
    }
    if (!hit) {
      const mine = tokens(p.name, new Set())
      hit = pick(cands.map((c) => ({ id: c.id, s: similarity(mine, c.tokFull) })), 0.8)
    }
    await prisma.product.update({
      where: { id: p.id },
      // Bez přípony velikosti — doplní productImage() (malý do mřížek, velký na detail).
      data: { imageCheckedAt: now, ...(hit && { imageUrl: `https://tcgplayer-cdn.tcgplayer.com/product/${hit}` }) },
    })
    if (hit) found++
  }
  log(`[produkty] obrázky: doplněno ${found} z ${missing.length} (kandidátů ${cands.length})`)
}
