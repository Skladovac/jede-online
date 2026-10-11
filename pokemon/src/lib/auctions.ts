import type { Prisma } from '@prisma/client'

/**
 * Aukce probíhají na jiném webu — u nás je jen odkaz, položky a čas konce.
 * Odkaz smí vést jen na ověřené weby (dětský web: žádné neznámé stránky). Další přidáme, až o ně lidé požádají.
 */
const HOSTS: { domains: string[]; label: string }[] = [
  { domains: ['facebook.com', 'fb.com', 'fb.me'], label: 'Facebook' },
  { domains: ['aukro.cz', 'aukro.sk'], label: 'Aukro' },
  { domains: ['vinted.cz', 'vinted.sk', 'vinted.com'], label: 'Vinted' },
  { domains: ['bazos.cz', 'bazos.sk'], label: 'Bazoš' },
  { domains: ['ebay.com', 'ebay.de', 'ebay.co.uk', 'ebay.at', 'ebay.fr', 'ebay.it', 'ebay.es'], label: 'eBay' },
]

const hostOf = (url: string) => {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
    return u.hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

/** Název webu, kde aukce probíhá (Facebook, Aukro…), nebo null, když odkaz není povolený. */
export function auctionSite(url: string) {
  const host = hostOf(url)
  if (!host) return null
  return HOSTS.find((h) => h.domains.some((d) => host === d || host.endsWith(`.${d}`)))?.label ?? null
}

export const AUCTION_SITES = HOSTS.map((h) => h.label)

/** Vyčistí odkaz: http → https, ořízne mezery. Vrací null, když nejde o povolený web. */
export function normalizeAuctionUrl(raw: string) {
  let url = raw.trim()
  if (/^http:\/\//i.test(url)) url = `https://${url.slice(7)}`
  if (!/^https:\/\//i.test(url)) url = `https://${url}`
  if (url.length > 500) return null
  return auctionSite(url) ? url : null
}

/** „2026-10-24T20:00“ z formuláře (pražský čas) → okamžik v UTC. Letní/zimní čas řeší Intl. */
export function parsePragueLocal(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  // Kolik ukazují pražské hodiny v okamžiku `guess` → rozdíl = posun Prahy proti UTC.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(guess))
      .map((x) => [x.type, x.value]),
  )
  const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute))
  const date = new Date(guess - (shown - guess))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Prodejce viditelný ostatním (ne zablokovaný; dítě jen se souhlasem rodiče). */
export const visibleSeller = { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] } satisfies Prisma.UserWhereInput

export const auctionInclude = {
  user: { select: { id: true, nickname: true } },
  items: {
    select: {
      id: true,
      card: { select: { id: true, name: true, imageUrl: true, localId: true, set: { select: { name: true, code: true, officialCount: true } } } },
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  },
} satisfies Prisma.AuctionInclude

export type AuctionFull = Prisma.AuctionGetPayload<{ include: typeof auctionInclude }>

export const MAX_ACTIVE_AUCTIONS = 10
export const MAX_AUCTION_ITEMS = 20
