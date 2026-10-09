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
  [key: string]: number | null | undefined
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

// "International/Retail Version" jsou na TCGplayeru dvě verze téhož produktu (stejný obrázek).
const STOP = new Set(['pokemon', 'the', 'of', 'and', 'tcg', 'pack', 'exclusive', 'a', 'x', 'version', 'international', 'retail'])
// Asijské edice TCGplayer nemá — nesmí dostat obrázek anglické verze.
const ASIAN = ['jp', 'japanese', 'chinese', 'simplified', 'traditional', 'indonesian', 'thai', 'korean']
const tokens = (s: string, drop: Set<string>) =>
  new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t) && !drop.has(t)))

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  if (ASIAN.some((t) => a.has(t) !== b.has(t))) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const jaccard = inter / (a.size + b.size - inter)
  // Název z TCGplayeru celý obsažený v našem: "Mini Tin [Mew]" ⊂ "Mew & Alolan Exeggutor Mini Tin".
  // Jen když pokrývá většinu našeho názvu, ať obecné "Booster" nesedne na všechno.
  const contained = inter === b.size && inter / a.size >= 0.6 ? 0.78 : 0
  return Math.max(jaccard, contained)
}

const price = (p?: CmPrice) => {
  // Stejně jako u karet: trend, pak krátkodobé průměry; `avg` až nakonec.
  const v = [p?.trend, p?.avg7, p?.avg30, p?.avg].find((x) => x && x > 0)
  return v ? new Prisma.Decimal(v.toFixed(2)) : null
}

const cardEur = (trend?: number | null, avg7?: number | null, avg30?: number | null) => {
  // U málo prodávaných karet (nové promo) bývá trend nesmyslně nízký (0,02 € při průměru 0,50 €) → vzít průměr.
  const avg = avg7 && avg7 > 0 ? avg7 : avg30
  const t = trend && avg && trend < avg * 0.25 ? null : trend
  const v = [t, avg7, avg30].find((x) => x && x > 0)
  return v ? new Prisma.Decimal(v.toFixed(2)) : null
}

/** Ceny karet podle idProduct z denního ceníku Cardmarketu: trend → avg7 → avg30 (nikdy `avg`), reverse = „-holo“. */
async function refreshCardPrices(prices: Map<number, CmPrice>, at: Date, log: (m: string) => void) {
  const cards = await prisma.card.findMany({
    where: { cmProductId: { not: null } },
    select: { id: true, cmProductId: true, priceEur: true, priceReverseEur: true },
  })
  // Karty, které už nějakou historii mají (jinak uložíme první bod i beze změny ceny).
  const withHistory = new Set((await prisma.cardPrice.findMany({ distinct: ['cardId'], select: { cardId: true } })).map((h) => h.cardId))
  const day = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(at)}T00:00:00Z`)
  const history: { cardId: string; day: Date; eur: Prisma.Decimal | null; reverseEur: Prisma.Decimal | null }[] = []
  let updated = 0
  for (let i = 0; i < cards.length; i += 200) {
    const batch = cards.slice(i, i + 200).flatMap((c) => {
      const p = prices.get(c.cmProductId!)
      if (!p) return []
      const base = pickStats(p as Record<string, number | null>)
      const reverse = pickStats(p as Record<string, number | null>, '-holo')
      const eur = cardEur(p.trend, p.avg7, p.avg30)
      const reverseEur = cardEur(p['trend-holo'], p['avg7-holo'], p['avg30-holo'])
      const changed = String(eur) !== String(c.priceEur) || String(reverseEur) !== String(c.priceReverseEur)
      if (changed || !withHistory.has(c.id)) history.push({ cardId: c.id, day, eur, reverseEur })
      return [
        prisma.card.update({
          where: { id: c.id },
          data: {
            priceEur: eur,
            priceReverseEur: reverseEur,
            priceStats: base || reverse ? { ...(base ?? {}), ...(reverse && { reverse }) } : Prisma.JsonNull,
            priceUpdatedAt: at,
          },
        }),
      ]
    })
    if (batch.length) await prisma.$transaction(batch)
    updated += batch.length
  }
  for (let i = 0; i < history.length; i += 5000)
    await prisma.cardPrice.createMany({ data: history.slice(i, i + 5000), skipDuplicates: true })
  log(`[ceny] karty z ceníku Cardmarketu: ${updated} z ${cards.length}, do historie ${history.length}`)
}

export async function syncProducts(log: (m: string) => void = console.log) {
  const [{ products }, { priceGuides, createdAt }, sets] = await Promise.all([
    getJson<{ products: CmProduct[] }>(`${CM}/productList/products_nonsingles_6.json`),
    getJson<{ priceGuides: CmPrice[]; createdAt?: string }>(`${CM}/priceGuide/price_guide_6.json`),
    prisma.cardSet.findMany({ where: { game: 'pokemon' }, select: { id: true, name: true } }),
  ])
  const prices = new Map(priceGuides.map((p) => [p.idProduct, p]))
  // Ceny karet z téhož ceníku (TCGdex přebírá ceny se zpožděním, tenhle soubor Cardmarket vydává každou noc).
  await refreshCardPrices(prices, createdAt ? new Date(createdAt) : new Date(), log).catch((err) =>
    log(`[ceny] obnova cen karet selhala: ${(err as Error).message}`),
  )
  // Indonéské (a indonésko-thajské) edice u nás nikdo nesbírá — do katalogu vůbec nepatří.
  const EXCLUDED_NAME = /\b(indonesian|thai)\b/i
  const list = products.filter((p) => !SKIP.has(p.categoryName) && !EXCLUDED_NAME.test(p.name))

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
  // Úklid dřív naimportovaných vyřazených produktů (jen pokud je nikdo nemá ve sbírce ani je neshání).
  const removed = await prisma.product.deleteMany({
    where: { name: { contains: 'Indonesian', mode: 'insensitive' }, items: { none: {} }, wants: { none: {} } },
  })
  if (removed.count) log(`[produkty] odstraněno ${removed.count} indonéských produktů`)
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
              if (!/^code card/i.test(p.name)) // digitální kódy, ne fyzický produkt
                cands.push({ id: p.productId, group: g.groupId, name: p.name, tokFull: tokens(`${strip(g.name)} ${p.name}`, new Set()) })
        } catch {
          /* jedna skupina nevadí */
        }
      }
    }),
  )

  const pick = (scored: { id: number; s: number; key: string }[], min: number) => {
    scored.sort((a, b) => b.s - a.s)
    const [best, second] = scored
    // Jen jisté shody: vysoká podobnost a jednoznačný vítěz. Remíza je OK jen mezi stejně pojmenovanými
    // verzemi téhož produktu (International / Retail).
    return best && best.s >= min && (!second || second.s < best.s || second.key === best.key) ? best.id : null
  }
  const key = (t: Set<string>) => [...t].sort().join(' ')

  let found = 0
  const now = new Date()
  for (const p of missing) {
    let hit: number | null = null
    const group = p.set ? groupByName.get(norm(p.set.name)) : undefined
    if (group) {
      const drop = tokens(p.set!.name, new Set())
      const mine = tokens(p.name, drop)
      hit = pick(
        cands
          .filter((c) => c.group === group.groupId)
          .map((c) => {
            const t = tokens(c.name, drop)
            return { id: c.id, s: similarity(mine, t), key: key(t) }
          }),
        0.75,
      )
    }
    if (!hit) {
      const mine = tokens(p.name, new Set())
      hit = pick(cands.map((c) => ({ id: c.id, s: similarity(mine, c.tokFull), key: key(c.tokFull) })), 0.8)
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
