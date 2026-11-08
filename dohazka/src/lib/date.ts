// Čisté datumové funkce. Žádné `server-only` — testy tenhle modul importují přímo.
// "Dnes" a "hodina" se vždy počítají v pražské zóně, nikdy z UTC.

const ZONA = 'Europe/Prague'

const dnesFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const hodinaFormat = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hour12: false })

/** Den v pražském čase jako "2026-11-08". */
export function pragueDayKey(d: Date): string {
  const p = Object.fromEntries(dnesFormat.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

/** Hodina 0–23 v pražském čase. (`% 24` kvůli prohlížečům, které o půlnoci vrátí "24".) */
export function pragueHour(d: Date): number {
  return Number(hodinaFormat.format(d)) % 24
}

/** "2026-11-08" → Date v UTC půlnoci (pro sloupce @db.Date, aby den neujížděl o zónu). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const klic = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Počet dní v měsíci (month 1–12). */
const dnuVMesici = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/**
 * Období výkazu pro měsíc `month` (1–12) roku `year`.
 * startDay 1 = kalendářní měsíc; startDay 16 = od 16. předchozího měsíce do 15. tohoto.
 * Začátek se omezí na délku měsíce (31. v únoru → 28.), konec končí den před začátkem
 * následujícího období, nejvýš však posledním dnem měsíce.
 */
export function periodRange(startDay: number, year: number, month: number): { fromKey: string; toKey: string } {
  if (startDay === 1) {
    return { fromKey: klic(year, month, 1), toKey: klic(year, month, dnuVMesici(year, month)) }
  }
  const py = month === 1 ? year - 1 : year
  const pm = month === 1 ? 12 : month - 1
  const from = Math.min(startDay, dnuVMesici(py, pm))
  // Konec = den před začátkem následujícího období (startDay v tomto měsíci), v rámci měsíce.
  const to = Math.min(startDay - 1, dnuVMesici(year, month))
  return { fromKey: klic(py, pm, from), toKey: klic(year, month, to) }
}

/** Hodiny s desetinnou čárkou bez zbytečných nul: 8.5 → "8,5", 8 → "8". */
export function formatHours(h: number): string {
  return String(Math.round(h * 100) / 100).replace('.', ',')
}

/** Všechny dny od `fromKey` do `toKey` včetně krajních. */
export function dayKeysInRange(fromKey: string, toKey: string): string[] {
  const out: string[] = []
  const end = parseDayKey(toKey).getTime()
  for (let t = parseDayKey(fromKey).getTime(); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}
