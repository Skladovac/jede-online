import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fillCatalogGaps } from '@/lib/catalog-fallback'
import { pickStats } from '@/lib/price-stats'

/**
 * Import katalogu Pokémon karet z TCGdex (https://tcgdex.dev, otevřené API zdarma).
 *
 * Seznam sad a karet je levný (1 + ~220 požadavků), ale rarita, varianty a ceny
 * jsou jen v detailu karty, takže se stahuje ~24 000 detailů. Při 6 souběžných
 * požadavcích to trvá zhruba 10 minut — proto běží v noci a na pozadí.
 */

const API = 'https://api.tcgdex.net/v2/en'
const CONCURRENCY = 6
// Loga, která TCGdex zatím nemá (nejnovější sady). Soubory v public/set-logos, převzaté z press.pokemon.com
// (licence pro nekomerční informační užití). Jakmile TCGdex logo doplní, má přednost.
const MANUAL_LOGOS: Record<string, string> = {
  '30th': '/set-logos/30th.png',
  '30th-c': '/set-logos/30th.png',
}
// Pokémon TCG Pocket je mobilní hra — její karty fyzicky neexistují, nesbírají se ani nevyměňují.
const EXCLUDED_SERIES = ['tcgp']

type TcgSetBrief = { id: string }
type TcgSet = {
  id: string
  name: string
  logo?: string
  symbol?: string
  releaseDate?: string
  serie: { id: string; name: string }
  abbreviation?: { official?: string }
  cardCount: { total: number; official: number }
  cards: { id: string; localId: string; name: string; image?: string }[]
}
type TcgCard = {
  id: string
  localId: string
  name: string
  image?: string
  category?: string
  rarity?: string
  variants?: { normal?: boolean; holo?: boolean; reverse?: boolean; firstEdition?: boolean }
  pricing?: {
    cardmarket?: {
      updated?: string
      avg?: number | null
      low?: number | null
      trend?: number | null
      avg1?: number | null
      avg7?: number | null
      avg30?: number | null
      'avg-holo'?: number | null
      'trend-holo'?: number | null
      'avg7-holo'?: number | null
      'avg30-holo'?: number | null
    } | null
  }
}

export type SyncStats = {
  startedAt: string
  finishedAt?: string
  sets: number
  cards: number
  cardDetailFailures: number
  setFailures: string[]
  error?: string
}

async function getJson<T>(path: string, attempt = 1): Promise<T> {
  const res = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  if (res.ok) return (await res.json()) as T
  if (attempt < 3 && (res.status >= 500 || res.status === 429)) {
    await new Promise((r) => setTimeout(r, 1000 * attempt))
    return getJson<T>(path, attempt + 1)
  }
  throw new Error(`TCGdex ${res.status} ${path}`)
}

// Id z TCGdex může být URL-kódované ("exu-%3F"); ukládáme čitelnou podobu.
const clean = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// Cenový trend Cardmarketu ("Price Trend"), jinak 7denní a 30denní průměr.
// Pole `avg` NEpoužívat: u nových karet drží zastaralý průměr z prvních dnů (např. 10 € místo 1,60 €).
// Nulu bereme jako "cena neznámá".
function eur(...candidates: (number | null | undefined)[]) {
  const v = candidates.find((c) => c && c > 0)
  return v ? new Prisma.Decimal(v.toFixed(2)) : null
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let i = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) await worker(items[i++])
    }),
  )
}

export async function syncCatalog(
  log: (msg: string) => void = console.log,
  onlySets?: string[], // pro ruční/testovací běh jen vybraných sad
): Promise<SyncStats> {
  const stats: SyncStats = { startedAt: new Date().toISOString(), sets: 0, cards: 0, cardDetailFailures: 0, setFailures: [] }

  const briefs = (await getJson<TcgSetBrief[]>('/sets')).filter((s) => !onlySets || onlySets.includes(s.id))
  log(`[catalog] ${briefs.length} sad ke zpracování`)

  const cardQueue: { setId: string; brief: TcgSet['cards'][number] }[] = []

  await pool(briefs, async ({ id }) => {
    try {
      const s = await getJson<TcgSet>(`/sets/${encodeURIComponent(id)}`)
      if (EXCLUDED_SERIES.includes(s.serie.id)) return
      const data = {
        game: 'pokemon',
        name: s.name,
        seriesId: s.serie.id,
        series: s.serie.name,
        code: s.abbreviation?.official ?? null,
        releaseDate: s.releaseDate ? new Date(s.releaseDate) : null,
        cardCount: s.cardCount.total,
        officialCount: s.cardCount.official,
        logoUrl: s.logo ?? MANUAL_LOGOS[s.id] ?? undefined,
        symbolUrl: s.symbol ?? undefined,
      }
      await prisma.cardSet.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data })
      for (const c of s.cards ?? []) cardQueue.push({ setId: s.id, brief: c })
      stats.sets++
    } catch (err) {
      stats.setFailures.push(id)
      log(`[catalog] sada ${id} selhala: ${(err as Error).message}`)
    }
  })
  log(`[catalog] sady hotové (${stats.sets}), stahuji ${cardQueue.length} detailů karet`)

  await pool(cardQueue, async ({ setId, brief }) => {
    let detail: TcgCard | null = null
    try {
      detail = await getJson<TcgCard>(`/cards/${encodeURIComponent(clean(brief.id))}`)
    } catch {
      stats.cardDetailFailures++ // uložíme aspoň základ ze seznamu sady
    }
    const cm = detail?.pricing?.cardmarket
    const v = detail?.variants
    const data = {
      setId,
      localId: clean(brief.localId),
      name: brief.name,
      // Když TCGdex obrázek nemá, nepřepisovat ten doplněný z pokemontcg.io (undefined = beze změny).
      imageUrl: brief.image ?? detail?.image ?? undefined,
      ...(detail && {
        category: detail.category ?? null,
        rarity: detail.rarity ?? null,
        hasNormal: v?.normal ?? false,
        hasHolo: v?.holo ?? false,
        hasReverse: v?.reverse ?? false,
        hasFirstEd: v?.firstEdition ?? false,
        priceEur: eur(cm?.trend, cm?.avg7, cm?.avg30),
        priceReverseEur: eur(cm?.['trend-holo'], cm?.['avg7-holo'], cm?.['avg30-holo']),
        priceStats: (() => {
          const base = pickStats(cm as Record<string, number | null>)
          const reverse = pickStats(cm as Record<string, number | null>, '-holo')
          return base || reverse ? { ...(base ?? {}), ...(reverse && { reverse }) } : Prisma.JsonNull
        })(),
        priceUpdatedAt: cm?.updated ? new Date(cm.updated) : null,
      }),
    }
    const id = clean(brief.id)
    try {
      await prisma.card.upsert({ where: { id }, create: { id, ...data, imageUrl: data.imageUrl ?? null }, update: data })
    } catch (err) {
      // Např. duplicitní číslo karty v sadě — jedna vadná karta nesmí shodit celý import.
      stats.cardDetailFailures++
      log(`[catalog] karta ${id} neuložena: ${(err as Error).message.split('\n').pop()}`)
      return
    }
    if (++stats.cards % 2000 === 0) log(`[catalog] ${stats.cards}/${cardQueue.length} karet`)
  })

  // Úklid sad, které už do katalogu nepatří (karty dřív, kvůli cizímu klíči).
  const excluded = { set: { seriesId: { in: EXCLUDED_SERIES } } }
  // Karty, které má někdo ve sbírce nebo mezi chybějícími, smazat nejdou — úklid nesmí shodit celý import.
  const removed = await prisma.card
    .deleteMany({ where: { ...excluded, items: { none: {} }, wants: { none: {} } } })
    .catch((err) => (console.error('[katalog] úklid karet selhal', err), { count: 0 }))
  await prisma.cardSet
    .deleteMany({ where: { seriesId: { in: EXCLUDED_SERIES }, cards: { none: {} } } })
    .catch((err) => console.error('[katalog] úklid sad selhal', err))
  if (removed.count) log(`[catalog] odstraněno ${removed.count} karet z vyřazených sérií`)

  try {
    await fillCatalogGaps(log)
  } catch (err) {
    log(`[catalog] doplnění z pokemontcg.io selhalo: ${(err as Error).message}`)
  }

  stats.finishedAt = new Date().toISOString()
  log(`[catalog] hotovo: ${stats.sets} sad, ${stats.cards} karet, ${stats.cardDetailFailures} bez detailu`)
  return stats
}
