import { prisma } from '@/lib/prisma'

/**
 * Doplnění z Pokémon TCG API (pokemontcg.io) tam, kde TCGdex nemá obrázky nebo karty
 * (Shiny Vault, Trainer Gallery, Galarian Gallery, Radiant Collection, promo karty, McDonald's…).
 * Běží po hlavním importu jen pro sady s mezerami, takže je to pár desítek požadavků.
 */

const API = 'https://api.pokemontcg.io/v2'

// Kde se názvy sad v obou zdrojích liší. Ostatní se párují podle názvu.
// Pozor: pokemontcg/scrydex „me55c“ (30th Classic Collection) čísluje podle původních sad (Charizard = 4/102),
// takže se k našim číslům 1–30 nehodí — tu sadu bereme z TCGplayeru podle názvu (viz TCGPLAYER níže).
const MANUAL: Record<string, { ptcg: string; prefix?: string }> = {
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

// ── Obrázky z TCGplayeru (přes tcgcsv.com) pro sady, které TCGdex ani pokemontcg nemají dobře ──
// match: 'number' = podle čísla karty (R/RGB → R, 065/128 → 065), 'name' = podle názvu (sady s původním číslováním).
// match 'kit' = trenérské balíčky: TCGplayer má dva balíčky v jedné skupině, karta se páruje číslem + jménem
// a při shodě podle názvu balíčku v názvu produktu („Psychic Energy (#8 - Latias)“).
const TCGPLAYER: Record<string, { group: number; match: 'number' | 'name' | 'kit'; deck?: string }> = {
  '30th': { group: 24722, match: 'number' },
  '30th-c': { group: 24837, match: 'name' },
  mep: { group: 24451, match: 'number' }, // MEP Black Star Promos (nové promo karty TCGdex dlouho nemá s obrázkem)
  cel25cc: { group: 2931, match: 'name' },
  '2023sv': { group: 23306, match: 'number' },
  '2024sv': { group: 24163, match: 'number' },
  mfb: { group: 23330, match: 'name' }, // TCGplayer tu čísla karet nemá — jen podle jména
  'tk-xy-p': { group: 1796, match: 'kit', deck: 'Pikachu' },
  'tk-xy-su': { group: 1796, match: 'kit', deck: 'Suicune' },
  'tk-xy-latia': { group: 1536, match: 'kit', deck: 'Latias' },
  'tk-xy-latio': { group: 1536, match: 'kit', deck: 'Latios' },
  'tk-xy-b': { group: 1533, match: 'kit', deck: 'Bisharp' },
  'tk-xy-w': { group: 1533, match: 'kit', deck: 'Wigglytuff' },
  'tk-xy-sy': { group: 1532, match: 'kit', deck: 'Sylveon' },
  'tk-xy-n': { group: 1532, match: 'kit', deck: 'Noivern' },
  'tk-bw-e': { group: 1538, match: 'kit', deck: 'Excadrill' },
  'tk-bw-z': { group: 1538, match: 'kit', deck: 'Zoroark' },
  'tk-hs-g': { group: 1540, match: 'kit', deck: 'Gyarados' },
  'tk-hs-r': { group: 1540, match: 'kit', deck: 'Raichu' },
  'tk-sm-r': { group: 2069, match: 'kit', deck: 'Raichu' },
  'tk-sm-l': { group: 2069, match: 'kit', deck: 'Lycanroc' },
  'tk-dp-m': { group: 1541, match: 'kit', deck: 'Manaphy' },
  'tk-dp-l': { group: 1541, match: 'kit', deck: 'Lucario' },
}
const TCGP_CDN = 'https://tcgplayer-cdn.tcgplayer.com/product/'

type TcgpProduct = { productId: number; name: string; extendedData?: { name: string; value: string }[] }

// Název pro párování: bez doplňků TCGplayeru („(Delta Species)“, „LV.X“, „ - 158/128“).
const nameKey = (s: string) =>
  norm(
    s
      .replace(/\s+-\s+[\w/]+$/, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\bLV\.?X\b/gi, ''),
  )

async function urlOk(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) })
    return r.ok && !!r.headers.get('content-type')?.startsWith('image/')
  } catch {
    return false
  }
}

// Obrázek, který víme, že nesedí: scrydex me55c (jiné číslování) nebo nedostupný (404).
async function badImage(url: string | null) {
  if (!url) return true
  if (url.includes('scrydex.com/pokemon/me55c-')) return true
  if (url.startsWith(TCGP_CDN)) return false
  const test = url.startsWith('https://assets.tcgdex.net/') ? `${url}/low.webp` : url
  return !(await urlOk(test))
}

async function fillFromTcgplayer(log: (m: string) => void) {
  let fixed = 0
  for (const [setId, cfg] of Object.entries(TCGPLAYER)) {
    try {
      const res = await fetch(`https://tcgcsv.com/tcgplayer/3/${cfg.group}/products`, {
        headers: { 'User-Agent': 'pokemon.jede.online catalog sync' },
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) throw new Error(`tcgcsv ${res.status}`)
      // Karty (ne zapečetěné produkty) poznáme podle čísla; u párování podle jména bereme i produkty bez čísla,
      // jen ne samotné balíčky („My First Battle [Pikachu & Bulbasaur]“).
      const products = ((await res.json()) as { results: TcgpProduct[] }).results.filter((p) =>
        cfg.match === 'name' ? !/\[.*&.*\]/.test(p.name) : p.extendedData?.some((e) => e.name === 'Number'),
      )
      const cards = await prisma.card.findMany({ where: { setId }, select: { id: true, localId: true, name: true, imageUrl: true } })
      const byNum = new Map<string, TcgpProduct>()
      const allByNum = new Map<string, TcgpProduct[]>()
      const byName = new Map<string, TcgpProduct[]>()
      for (const p of products) {
        const num = p.extendedData?.find((e) => e.name === 'Number')?.value.split('/')[0] ?? ''
        // Stejné číslo má víc verzí („[Staff]“, „Pokemon Center Exclusive“) — bereme základní (nejkratší název).
        allByNum.set(numKey(num), [...(allByNum.get(numKey(num)) ?? []), p])
        const prev = byNum.get(numKey(num))
        if (!prev || p.name.length < prev.name.length) byNum.set(numKey(num), p)
        const k = nameKey(p.name)
        byName.set(k, [...(byName.get(k) ?? []), p])
      }
      for (const c of cards) {
        let p: TcgpProduct | undefined
        if (cfg.match === 'number') p = byNum.get(numKey(c.localId))
        else if (cfg.match === 'kit') {
          // Stejné číslo + stejné jméno karty; při víc kandidátech ten s názvem našeho balíčku.
          const same = (allByNum.get(numKey(c.localId)) ?? []).filter((x) => nameKey(x.name) === nameKey(c.name))
          const deck = cfg.deck?.toLowerCase()
          p = (deck && same.find((x) => x.name.toLowerCase().includes(deck))) || same.find((x) => !/ - [A-Z]/.test(x.name)) || same[0]
        }
        else {
          const list = byName.get(nameKey(c.name)) ?? []
          // Dvojice se stejným názvem (Darkrai & Cresselia LEGEND horní/dolní půlka): podle pořadí čísel.
          if (list.length > 1) {
            const same = cards.filter((x) => nameKey(x.name) === nameKey(c.name)).sort((a, b) => a.localId.localeCompare(b.localId))
            // Napřed „(top)“, pak základní verze (nejkratší název, bez „(Blue Border)“ apod.).
            const sorted = [...list].sort((a, b) => (/\(top\)/i.test(a.name) ? -1 : /\(top\)/i.test(b.name) ? 1 : a.name.length - b.name.length))
            p = sorted[same.findIndex((x) => x.id === c.id)]
          } else p = list[0]
        }
        if (!p || !(await badImage(c.imageUrl))) continue
        await prisma.card.update({ where: { id: c.id }, data: { imageUrl: `${TCGP_CDN}${p.productId}` } })
        fixed++
      }
    } catch (err) {
      log(`[catalog] obrázky z TCGplayeru pro ${setId} selhaly: ${(err as Error).message}`)
    }
  }
  log(`[catalog] obrázky z TCGplayeru: ${fixed}`)
}

export async function fillCatalogGaps(log: (m: string) => void = console.log) {
  await fillFromTcgplayer(log)
  const gaps = await prisma.cardSet.findMany({
    // Jen anglické sady (pokemontcg.io japonské nezná).
    where: { game: 'pokemon', language: 'en' },
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
