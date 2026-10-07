import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Import katalogu Pokémon karet z TCGdex (https://tcgdex.dev, otevřené API zdarma).
 *
 * Seznam sad a karet je levný (1 + ~220 požadavků), ale rarita, varianty a ceny
 * jsou jen v detailu karty, takže se stahuje ~24 000 detailů. Při 6 souběžných
 * požadavcích to trvá zhruba 10 minut — proto běží v noci a na pozadí.
 */

const API = 'https://api.tcgdex.net/v2/en'
const CONCURRENCY = 6

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
      trend?: number | null
      'avg-holo'?: number | null
      'trend-holo'?: number | null
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

// Průměr prodejů; když chybí, trend. Nulu bereme jako "cena neznámá".
function eur(avg?: number | null, trend?: number | null) {
  const v = avg || trend
  return v && v > 0 ? new Prisma.Decimal(v.toFixed(2)) : null
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
      const data = {
        game: 'pokemon',
        name: s.name,
        seriesId: s.serie.id,
        series: s.serie.name,
        code: s.abbreviation?.official ?? null,
        releaseDate: s.releaseDate ? new Date(s.releaseDate) : null,
        cardCount: s.cardCount.total,
        officialCount: s.cardCount.official,
        logoUrl: s.logo ?? null,
        symbolUrl: s.symbol ?? null,
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
      imageUrl: brief.image ?? detail?.image ?? null,
      ...(detail && {
        category: detail.category ?? null,
        rarity: detail.rarity ?? null,
        hasNormal: v?.normal ?? false,
        hasHolo: v?.holo ?? false,
        hasReverse: v?.reverse ?? false,
        hasFirstEd: v?.firstEdition ?? false,
        priceEur: eur(cm?.avg, cm?.trend),
        priceReverseEur: eur(cm?.['avg-holo'], cm?.['trend-holo']),
        priceUpdatedAt: cm?.updated ? new Date(cm.updated) : null,
      }),
    }
    const id = clean(brief.id)
    try {
      await prisma.card.upsert({ where: { id }, create: { id, ...data }, update: data })
    } catch (err) {
      // Např. duplicitní číslo karty v sadě — jedna vadná karta nesmí shodit celý import.
      stats.cardDetailFailures++
      log(`[catalog] karta ${id} neuložena: ${(err as Error).message.split('\n').pop()}`)
      return
    }
    if (++stats.cards % 2000 === 0) log(`[catalog] ${stats.cards}/${cardQueue.length} karet`)
  })

  stats.finishedAt = new Date().toISOString()
  log(`[catalog] hotovo: ${stats.sets} sad, ${stats.cards} karet, ${stats.cardDetailFailures} bez detailu`)
  return stats
}
