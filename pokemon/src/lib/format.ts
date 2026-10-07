import type { Prisma } from '@prisma/client'

const eurFmt = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR' })

export function formatEur(v: Prisma.Decimal | null | undefined) {
  return v == null ? null : eurFmt.format(Number(v))
}

// Obrázky jdou přes naši cestu /img/ — v produkci je nginx kešuje z CDN TCGdex
// (jejich CDN občas vypadne a nechceme ho zatěžovat), lokálně je přepošle rewrite v next.config.
const TCGDEX_ASSETS = 'https://assets.tcgdex.net/'
const viaProxy = (url: string) => (url.startsWith(TCGDEX_ASSETS) ? '/img/' + url.slice(TCGDEX_ASSETS.length) : url)

// TCGdex dává adresu obrázku bez přípony.
export function cardImage(url: string | null, size: 'low' | 'high' = 'low') {
  return url ? viaProxy(`${url}/${size}.webp`) : null
}

export function setLogo(url: string | null) {
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
