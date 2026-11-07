// Čistě formátovací funkce (bez serveru) — používá je web i administrace.

const NBSP = ' '

/** 6480000 → „6 480 000 Kč“ (nezlomitelné mezery). */
export function formatPrice(price: number | null | undefined, rent = false) {
  if (price == null) return 'Cena na vyžádání'
  const n = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(price).replace(/\s/g, NBSP)
  return `${n}${NBSP}Kč${rent ? `${NBSP}/${NBSP}měsíc` : ''}`
}

export const formatArea = (m2: number | null | undefined) =>
  m2 == null ? '' : `${new Intl.NumberFormat('cs-CZ').format(m2).replace(/\s/g, NBSP)}${NBSP}m²`

/** Titulek pro URL: „Rodinný dům 6+1, Kvasice“ → „rodinny-dum-6-1-kvasice“. */
export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/m²/g, 'm2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Česká sazba: jednopísmenné předložky a spojky nesmí zůstat na konci řádku. */
export const nbsp = (s: string) => s.replace(/(?<=^|[\s(])([ksvzouai]) +/gi, `$1${NBSP}`)

/** Popis z administrace: odstavce oddělené prázdným řádkem. */
export const paragraphs = (s: string) =>
  s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

export const ENERGY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

export const ENERGY_LABEL: Record<string, string> = {
  A: 'mimořádně úsporná',
  B: 'velmi úsporná',
  C: 'úsporná',
  D: 'méně úsporná',
  E: 'nehospodárná',
  F: 'velmi nehospodárná',
  G: 'mimořádně nehospodárná',
}

/** Měsíční splátka anuitního úvěru. Sazba v % ročně. */
export function monthlyPayment(principal: number, ratePct: number, years: number) {
  const n = Math.round(years * 12)
  if (principal <= 0 || n <= 0) return 0
  const r = ratePct / 100 / 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

export function formatDate(d: Date) {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Prague' }).format(d)
}

export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  }).format(d)
}

/** Sloupce mřížky karet: 2 nebo 4 karty po dvou (žádná osiřelá karta), jinak po třech. */
export const gridCols = (n: number) => (n === 2 || n === 4 ? 'lg:grid-cols-2 lg:gap-x-12' : 'lg:grid-cols-3')
