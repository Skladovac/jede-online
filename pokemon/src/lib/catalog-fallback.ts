import { prisma } from '@/lib/prisma'

/**
 * Doplnění z Pokémon TCG API (pokemontcg.io) tam, kde TCGdex nemá obrázky nebo karty
 * (Shiny Vault, Trainer Gallery, Galarian Gallery, Radiant Collection, promo karty, McDonald's…).
 * Běží po hlavním importu jen pro sady s mezerami, takže je to pár desítek požadavků.
 */

const API = 'https://api.pokemontcg.io/v2'

// Kde se názvy sad v obou zdrojích liší. Ostatní se párují podle názvu.
const MANUAL: Record<string, { ptcg: string; prefix?: string }> = {
  '30th-c': { ptcg: 'me55c' },
  svp: { ptcg: 'svp' },
  sve: { ptcg: 'sve' },
  rc: { ptcg: 'bw11', prefix: 'RC' }, // Radiant Collection je podsada Legendary Treasures (RC1–RC25)
  cel25cc: { ptcg: 'cel25c' },
  hgssp: { ptcg: 'hsp' },
  bog: { ptcg: 'bp' },
}

type PtcgSet = { id: string; name: string }
type PtcgCard = { number: string; name: string; rarity?: string; images: { small: string } }

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
// "SV001" ~ "SV1", "045" ~ "45", "TG01" ~ "TG1"
const numKey = (n: string) => n.toUpperCase().replace(/(\D*)0*(\d+)/, '$1$2')

// API bez klíče občas vrací 500/502 — zkusit znovu s rostoucí pauzou.
async function get<T>(path: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
    if (res.ok) return (await res.json()) as T
    if (res.status < 500 && res.status !== 429) throw new Error(`pokemontcg ${res.status} ${path}`)
    if (attempt >= 5) throw new Error(`pokemontcg ${res.status} ${path}`)
  } catch (err) {
    if (attempt >= 5 || (err as Error).message.startsWith('pokemontcg 4')) throw err
  }
  await new Promise((r) => setTimeout(r, 3000 * attempt))
  return get<T>(path, attempt + 1)
}

async function ptcgCards(setId: string) {
  const out: PtcgCard[] = []
  for (let page = 1; page < 10; page++) {
    const r = await get<{ data: PtcgCard[]; totalCount: number }>(
      `/cards?q=set.id:${setId}&pageSize=250&page=${page}&select=number,name,rarity,images`,
    )
    out.push(...r.data)
    if (out.length >= r.totalCount || !r.data.length) break
  }
  return out
}

export async function fillCatalogGaps(log: (m: string) => void = console.log) {
  const gaps = await prisma.cardSet.findMany({
    where: { game: 'pokemon' },
    include: { cards: { select: { id: true, localId: true, imageUrl: true } } },
  })
  const todo = gaps.filter((s) => s.cards.length < s.cardCount || s.cards.some((c) => !c.imageUrl))
  if (!todo.length) return

  const ptcgSets = (await get<{ data: PtcgSet[] }>('/sets?pageSize=250&select=id,name')).data
  const byName = new Map(ptcgSets.map((s) => [norm(s.name), s.id]))

  let images = 0
  let added = 0
  for (const set of todo) {
    const map = MANUAL[set.id] ?? (byName.has(norm(set.name)) ? { ptcg: byName.get(norm(set.name))! } : null)
    if (!map) continue
    try {
      const cards = (await ptcgCards(map.ptcg)).filter((c) => !map.prefix || c.number.startsWith(map.prefix))
      const ours = new Map(set.cards.map((c) => [numKey(c.localId), c]))
      for (const pc of cards) {
        const mine = ours.get(numKey(pc.number))
        if (mine) {
          if (!mine.imageUrl) {
            await prisma.card.update({ where: { id: mine.id }, data: { imageUrl: pc.images.small } })
            images++
          }
        } else if (set.cards.length < set.cardCount) {
          // TCGdex kartu v sadě vůbec nemá — založíme ji.
          await prisma.card
            .create({
              data: {
                id: `${set.id}-${pc.number}`,
                setId: set.id,
                localId: pc.number,
                name: pc.name,
                rarity: pc.rarity ?? null,
                imageUrl: pc.images.small,
              },
            })
            .then(() => added++)
            .catch(() => {}) // kolize čísla — přeskočit
        }
      }
    } catch (err) {
      log(`[catalog] doplnění ${set.id} selhalo: ${(err as Error).message}`)
    }
  }
  log(`[catalog] doplněno z pokemontcg.io: ${images} obrázků, ${added} karet`)
}
