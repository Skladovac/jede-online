import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pickStats } from '@/lib/price-stats'

/**
 * Japonské sady (jen moderní éry Scarlet & Violet a Mega) z TCGdex /v2/ja.
 * TCGdex má japonské názvy (フシギダネ), proto anglické názvy sad i karet bereme z TCGplayeru
 * (tcgcsv kategorie 85 = Pokémon Japan; skupina se páruje podle zkratky = id sady v TCGdex, karta podle čísla).
 * Ceny: TCGdex dává idProduct Cardmarketu → noční obnova z ceníku (product-sync) jako u anglických karet.
 * V naší DB mají japonské sady id s předponou „ja-“ (ja-SV2a) a language = 'ja'.
 */

const API = 'https://api.tcgdex.net/v2/ja'
const TCGCSV = 'https://tcgcsv.com/tcgplayer/85'
const SERIES = ['SV', 'M'] // éry Scarlet & Violet a Mega
const SERIES_EN: Record<string, string> = { SV: 'Scarlet & Violet (JP)', M: 'Mega Evolution (JP)' }
const CONCURRENCY = 6
// Sady, které na TCGplayeru nemají zkratku (skupina podle id) nebo vůbec nejsou — ruční anglický název.
const MANUAL_GROUP: Record<string, number> = { MC: 24567 }
const MANUAL_NAME: Record<string, string> = {
  MC: 'Start Deck 100 Battle Collection',
  SVLS: 'Stellar Tera Type Starter Set Ceruledge ex',
}

type JaSetBrief = { id: string }
type JaSet = {
  id: string
  name: string
  logo?: string
  symbol?: string
  releaseDate?: string
  serie: { id: string; name: string }
  cardCount: { total: number; official: number }
  cards: { id: string; localId: string; name: string; image?: string }[]
}
type JaCard = {
  rarity?: string
  category?: string
  image?: string
  variants?: { normal?: boolean; holo?: boolean; reverse?: boolean; firstEdition?: boolean }
  variants_detailed?: { foil?: string; thirdParty?: { cardmarket?: number } }[]
  pricing?: { cardmarket?: Record<string, number | string | null> | null }
}
type TcgGroup = { groupId: number; name: string; abbreviation?: string | null }
type TcgProduct = { productId: number; name: string; extendedData?: { name: string; value: string }[] }

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'pokemon.jede.online catalog sync' },
    signal: AbortSignal.timeout(30_000),
  })
  if (res.ok) return (await res.json()) as T
  if (attempt < 3 && (res.status >= 500 || res.status === 429)) {
    await new Promise((r) => setTimeout(r, 1500 * attempt))
    return getJson<T>(url, attempt + 1)
  }
  throw new Error(`${res.status} ${url}`)
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < items.length) await worker(items[i++]) }))
}

const eur = (...c: (number | string | null | undefined)[]) => {
  const v = c.map(Number).find((x) => x > 0)
  return v ? new Prisma.Decimal(v.toFixed(2)) : null
}
const numKey = (n: string) => n.toUpperCase().replace(/^0+(?=\d)/, '')
// „Bulbasaur - 001/165“, „Pikachu (Master Ball Pattern)“ → „Bulbasaur“, „Pikachu“
const cleanName = (s: string) => s.replace(/\s+-\s+[\w/]+$/, '').replace(/\s*\((?:[^)]*(?:Pattern|Holo|Reverse|Foil)[^)]*)\)\s*$/i, '').trim()

export async function syncJapanese(log: (m: string) => void = console.log) {
  const [briefs, groups] = await Promise.all([
    getJson<JaSetBrief[]>(`${API}/sets`),
    getJson<{ results: TcgGroup[] }>(`${TCGCSV}/groups`).then((r) => r.results).catch(() => [] as TcgGroup[]),
  ])
  const groupByAbbr = new Map(groups.filter((g) => g.abbreviation).map((g) => [g.abbreviation!.toUpperCase(), g]))

  const sets: JaSet[] = []
  await pool(briefs, async ({ id }) => {
    try {
      const s = await getJson<JaSet>(`${API}/sets/${encodeURIComponent(id)}`)
      if (SERIES.includes(s.serie.id)) sets.push(s)
    } catch (err) {
      log(`[ja] sada ${id} selhala: ${(err as Error).message}`)
    }
  })
  log(`[ja] ${sets.length} japonských sad (SV + Mega)`)

  let cards = 0
  for (const s of sets) {
    const group = groupByAbbr.get(s.id.toUpperCase()) ?? groups.find((g) => g.groupId === MANUAL_GROUP[s.id])
    // Anglické názvy karet podle čísla z TCGplayeru (když skupinu nenajdeme, zůstane japonský název).
    const enByNum = new Map<string, string>()
    // Obrázek z TCGplayeru podle čísla, když ho TCGdex u japonské karty nemá (u víc verzí základní = nejkratší název).
    const imgByNum = new Map<string, { id: number; name: string }>()
    if (group) {
      try {
        const prods = (await getJson<{ results: TcgProduct[] }>(`${TCGCSV}/${group.groupId}/products`)).results
        for (const p of prods) {
          const num = p.extendedData?.find((e) => e.name === 'Number')?.value.split('/')[0]
          if (num && !enByNum.has(numKey(num))) enByNum.set(numKey(num), cleanName(p.name))
          if (num) {
            const prev = imgByNum.get(numKey(num))
            if (!prev || p.name.length < prev.name.length) imgByNum.set(numKey(num), { id: p.productId, name: p.name })
          }
        }
      } catch (err) {
        log(`[ja] názvy pro ${s.id} selhaly: ${(err as Error).message}`)
      }
    }
    const setId = `ja-${s.id}`
    const nameEn = MANUAL_NAME[s.id] ?? (group ? group.name.replace(/^[^:]+:\s*/, '') : null)
    const data = {
      game: 'pokemon',
      language: 'ja',
      name: nameEn ? `${nameEn}` : s.name,
      nameOriginal: s.name,
      seriesId: `ja-${s.serie.id}`,
      series: SERIES_EN[s.serie.id] ?? s.serie.name,
      code: s.id,
      releaseDate: s.releaseDate ? new Date(s.releaseDate) : null,
      cardCount: s.cardCount.total,
      officialCount: s.cardCount.official,
      logoUrl: s.logo ?? undefined,
      symbolUrl: s.symbol ?? undefined,
    }
    await prisma.cardSet.upsert({ where: { id: setId }, create: { id: setId, ...data }, update: data })

    await pool(s.cards ?? [], async (brief) => {
      let detail: JaCard | null = null
      try {
        detail = await getJson<JaCard>(`${API}/cards/${encodeURIComponent(brief.id)}`)
      } catch {
        /* uložíme aspoň základ */
      }
      const cm = detail?.pricing?.cardmarket ?? null
      const v = detail?.variants
      const base = cm ? pickStats(cm as Record<string, number | null>) : null
      const reverse = cm ? pickStats(cm as Record<string, number | null>, '-holo') : null
      const id = `ja-${brief.id}`
      const row = {
        setId,
        localId: brief.localId,
        name: enByNum.get(numKey(brief.localId)) ?? brief.name,
        nameOriginal: brief.name,
        imageUrl:
          brief.image ??
          detail?.image ??
          (imgByNum.get(numKey(brief.localId)) ? `https://tcgplayer-cdn.tcgplayer.com/product/${imgByNum.get(numKey(brief.localId))!.id}` : null),
        ...(detail && {
          category: detail.category ?? null,
          rarity: detail.rarity ?? null,
          hasNormal: v?.normal ?? false,
          hasHolo: v?.holo ?? false,
          hasReverse: v?.reverse ?? false,
          hasFirstEd: v?.firstEdition ?? false,
          hasPokeball: !!detail.variants_detailed?.some((x) => x.foil === 'pokeball'),
          hasMasterball: !!detail.variants_detailed?.some((x) => x.foil === 'masterball'),
          priceEur: eur(cm?.trend, cm?.avg7, cm?.avg30),
          priceReverseEur: eur(cm?.['trend-holo'], cm?.['avg7-holo'], cm?.['avg30-holo']),
          priceStats: base || reverse ? { ...(base ?? {}), ...(reverse && { reverse }) } : Prisma.JsonNull,
          priceUpdatedAt: typeof cm?.updated === 'string' ? new Date(cm.updated) : null,
          cmProductId:
            (typeof cm?.idProduct === 'number' ? cm.idProduct : null) ??
            detail.variants_detailed?.find((x) => x.thirdParty?.cardmarket)?.thirdParty?.cardmarket ??
            null,
        }),
      }
      try {
        await prisma.card.upsert({ where: { id }, create: { id, ...row }, update: row })
        cards++
      } catch (err) {
        log(`[ja] karta ${id} neuložena: ${(err as Error).message.split('\n').pop()}`)
      }
    })
  }
  // Karty bez anglického názvu (TCGplayer je nemá spárované): stejný Pokémon má všude stejné jméno,
  // takže použijeme nejčastější překlad stejného japonského názvu z ostatních sad.
  const pairs = await prisma.$queryRaw<{ jp: string; en: string }[]>`
    SELECT DISTINCT ON ("nameOriginal") "nameOriginal" AS jp, name AS en
    FROM (SELECT "nameOriginal", name, count(*) c FROM "Card"
          WHERE "nameOriginal" IS NOT NULL AND name <> "nameOriginal" GROUP BY 1, 2) x
    ORDER BY "nameOriginal", c DESC`
  const jpToEn = new Map(pairs.map((p) => [p.jp, p.en]))
  const untranslated = await prisma.$queryRaw<{ id: string; nameOriginal: string }[]>`
    SELECT c.id, c."nameOriginal" FROM "Card" c JOIN "CardSet" s ON s.id = c."setId"
    WHERE s.language = 'ja' AND c.name = c."nameOriginal"`
  let filled = 0
  for (const c of untranslated) {
    const en = jpToEn.get(c.nameOriginal)
    if (!en) continue
    await prisma.card.update({ where: { id: c.id }, data: { name: en } })
    filled++
  }
  log(`[ja] hotovo: ${sets.length} sad, ${cards} karet, dopočítané anglické názvy ${filled} z ${untranslated.length}`)
}
