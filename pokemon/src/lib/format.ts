import type { Prisma } from '@prisma/client'

const eurFmt = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR' })
const czkFmt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 })

// Kurz EUR/CZK z ČNB. Nastavuje ho lib/fx.ts (ensureEurCzk) na začátku stránky; tady jen čteme.
let czkRate: number | null = null
export const setCzkRate = (r: number | null) => {
  czkRate = r
}

/** Orientační přepočet na koruny, např. "40 Kč" (null, když kurz zatím nemáme). */
export function formatCzk(eur: number | Prisma.Decimal | null | undefined) {
  if (eur == null || !czkRate) return null
  return `${czkFmt.format(Math.max(1, Math.round(Number(eur) * czkRate)))} Kč`
}

/** "1,63 € (40 Kč)" — korunová částka podle kurzu ČNB v závorce. */
export function formatEur(v: Prisma.Decimal | number | null | undefined) {
  if (v == null) return null
  const czk = formatCzk(v)
  return `${eurFmt.format(Number(v))}${czk ? ` (${czk})` : ''}`
}

// Obrázky jdou přes naši cestu /img/ — v produkci je nginx kešuje z CDN TCGdex
// (jejich CDN občas vypadne a nechceme ho zatěžovat), lokálně je přepošle rewrite v next.config.
const TCGDEX_ASSETS = 'https://assets.tcgdex.net/'
// Doplněné obrázky z pokemontcg.io jdou přes /img2/ (stejná keš v nginx).
const PTCG_ASSETS = 'https://images.pokemontcg.io/'
const viaProxy = (url: string) =>
  url.startsWith(TCGDEX_ASSETS)
    ? '/img/' + url.slice(TCGDEX_ASSETS.length)
    : url.startsWith(PTCG_ASSETS)
      ? '/img2/' + url.slice(PTCG_ASSETS.length)
      : url

// TCGdex dává adresu obrázku bez přípony; pokemontcg.io celou adresu malého PNG (velké má _hires).
export function cardImage(url: string | null, size: 'low' | 'high' = 'low') {
  if (!url) return null
  // pokemontcg.io část obrázků přesunul na scrydex: ".../small" a ".../large", bez přípony.
  if (url.startsWith('https://images.scrydex.com/')) return size === 'high' ? url.replace(/\/small$/, '/large') : url
  // Doplněné z TCGplayeru (30th Celebration a Classic Collection): uloženo bez přípony, servíruje nginx keš /img3/.
  if (url.startsWith('https://tcgplayer-cdn.tcgplayer.com/'))
    return '/img3/' + url.slice('https://tcgplayer-cdn.tcgplayer.com/'.length) + (size === 'high' ? '_in_1000x1000.jpg' : '_400w.jpg')
  if (url.startsWith(PTCG_ASSETS)) return viaProxy(size === 'high' ? url.replace(/\.png$/, '_hires.png') : url)
  return viaProxy(`${url}/${size}.webp`)
}

// Produkty: obrázky TCGplayeru přes /img3/ (nginx keš). Uložené bez přípony velikosti.
const TCGP_ASSETS = 'https://tcgplayer-cdn.tcgplayer.com/'
export function productImage(url: string | null, size: 'low' | 'high' = 'low') {
  if (!url?.startsWith(TCGP_ASSETS)) return null
  return '/img3/' + url.slice(TCGP_ASSETS.length) + (size === 'high' ? '_in_1000x1000.jpg' : '_200w.jpg')
}

export function setLogo(url: string | null) {
  if (url?.startsWith('/')) return url // vlastní soubor v public/set-logos
  return url ? viaProxy(`${url}.webp`) : null
}

// Čísla karet obsahují i písmena ("TG01", "SV001"), proto přirozené řazení.
export const byLocalId = (a: { localId: string }, b: { localId: string }) =>
  a.localId.localeCompare(b.localId, 'en', { numeric: true })

const RARITY_CS: Record<string, string> = {
  Common: 'Běžná',
  Uncommon: 'Méně běžná',
  Rare: 'Vzácná',
  'Rare Holo': 'Vzácná holo',
  'Double rare': 'Double rare',
  'Ultra Rare': 'Ultra rare',
  'Illustration rare': 'Illustration rare',
  'Special illustration rare': 'Special illustration rare',
  'Hyper rare': 'Hyper rare',
}
export const rarityLabel = (r: string | null) => (r ? (RARITY_CS[r] ?? r) : null)

const CATEGORY_CS: Record<string, string> = { Pokemon: 'Pokémon', Trainer: 'Trenér', Energy: 'Energie' }
export const categoryLabel = (c: string) => CATEGORY_CS[c] ?? c

/**
 * Podsady se stejným logem jako hlavní sada (30th Classic Collection, Trainer Gallery…): štítek, ať jdou odlišit.
 * Ve skupině se stejným logem je hlavní sada ta s nejvíc kartami; ostatní dostanou svůj název bez společného začátku.
 */
export function subsetLabels(sets: { id: string; name: string; logoUrl: string | null; cardCount: number }[]) {
  const byLogo = new Map<string, typeof sets>()
  for (const s of sets) if (s.logoUrl) byLogo.set(s.logoUrl, [...(byLogo.get(s.logoUrl) ?? []), s])
  const out = new Map<string, string>()
  for (const group of byLogo.values()) {
    if (group.length < 2) continue
    const [main, ...rest] = [...group].sort((a, b) => b.cardCount - a.cardCount)
    const mainWords = main.name.split(/\s+/)
    for (const s of rest) {
      const words = s.name.split(/\s+/)
      let i = 0
      while (i < words.length - 1 && words[i] === mainWords[i]) i++
      out.set(s.id, words.slice(i).join(' '))
    }
  }
  return out
}

// Zobrazovaný název sady tam, kde je oficiální název matoucí (Celebrations 2021 = 25. výročí vs. 30th Celebration).
// V databázi zůstává oficiální název (hledání, párování produktů s Cardmarketem).
const SET_DISPLAY_NAME: Record<string, string> = {
  cel25: 'Celebrations · 25th Anniversary',
  cel25cc: 'Celebrations Classic Collection · 25th Anniversary',
}
export const setDisplayName = (set: { id: string; name: string }) => SET_DISPLAY_NAME[set.id] ?? set.name
