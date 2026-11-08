// Čisté funkce pro zápis dne: parsování hodin a časů, výpočet délky směny, validace.
// Žádné `server-only` a žádná databáze — testy tenhle modul importují přímo v Node.

import { z } from 'zod'
import { parseDayKey } from '@/lib/date'

// Hodnoty musí odpovídat enumu EntryKind v Prisma schématu.
export const ENTRY_KINDS = ['WORK', 'VACATION', 'SICK', 'DAYOFF'] as const
export type EntryKindValue = (typeof ENTRY_KINDS)[number]

// Tvar hodin: 1–2 cifry, volitelně čárka nebo tečka a 1–2 desetinná místa.
const HOURS_SHAPE = /^\d{1,2}([.,]\d{1,2})?$/
// Tvar času: "7:00", "07:00", "7.00". Hodiny a minuty kontrolujeme až potom.
const TIME_SHAPE = /^(\d{1,2})[:.](\d{2})$/
const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Hodiny z uživatelského vstupu: "8,5", "8.5", "8", " 8,5 " → číslo.
 * Tvar ověřujeme regulárním výrazem PŘED převodem, protože `Number()` by spolklo
 * "1e3", "0x10" nebo mezery a vrátilo číslo, které tam nepatří.
 */
export function parseHours(raw: string): number | null {
  const s = raw.trim()
  if (!HOURS_SHAPE.test(s)) return null
  const n = Number(s.replace(',', '.'))
  return n >= 0 && n <= 24 ? n : null
}

/** Čas z uživatelského vstupu na "HH:MM", jinak null. */
export function parseTime(raw: string): string | null {
  const m = TIME_SHAPE.exec(raw.trim())
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${m[2]}`
}

/**
 * Délka směny v hodinách, zaokrouhlená na 2 desetinná místa.
 * Když je `to` dřív než `from`, je to noční směna přes půlnoc (22:00–06:00 = 8).
 */
export function hoursFromRange(from: string, to: string): number | null {
  const a = parseTime(from)
  const b = parseTime(to)
  if (a === null || b === null) return null
  const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  let diff = minutesOf(b) - minutesOf(a)
  if (diff < 0) diff += 24 * 60
  return Math.round((diff / 60) * 100) / 100
}

// Normalizovaný zápis dne — tvar, který jde do databáze.
export const entrySchema = z.object({
  day: z.string().regex(DAY_SHAPE),
  kind: z.enum(ENTRY_KINDS),
  hours: z.number().min(0).max(24).nullable(),
  // V databázi na časy není žádné omezení formátu, takže ho hlídáme tady.
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  toTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  place: z.string().max(200).nullable(),
  note: z.string().max(500).nullable(),
})
export type EntryInput = z.infer<typeof entrySchema>

export type EntryValidation = { ok: true; value: EntryInput } | { ok: false; error: string }

const fail = (error: string): EntryValidation => ({ ok: false, error })

/** Délka v code pointech, aby česká diakritika počítala jako jeden znak. */
const delka = (s: string) => [...s].length

/**
 * Validuje a normalizuje zápis dne z neznámého vstupu (typicky z formuláře).
 * Chybová hláška je vždy jedna česká věta pro uživatele.
 */
export function validateEntry(input: unknown): EntryValidation {
  if (typeof input !== 'object' || input === null) return fail('Zápis dne chybí nebo má špatný tvar.')
  const r = input as Record<string, unknown>
  // Prázdný řetězec nebo jiný typ znamená "nevyplněno".
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const kind = r.kind
  if (typeof kind !== 'string' || !(ENTRY_KINDS as readonly string[]).includes(kind)) {
    return fail('Neznámý typ dne.')
  }

  const day = text(r.day)
  if (!DAY_SHAPE.test(day)) return fail('Neplatné datum.')
  // Tvar nestačí: parseDayKey neplatné datum (2026-02-31) tiše přetočí na jiný den,
  // proto ověříme, že převod vyjde zpět na stejný řetězec.
  const dayDate = parseDayKey(day)
  if (Number.isNaN(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) {
    return fail('Neplatné datum.')
  }

  const hoursRaw = text(r.hours)
  const hours = hoursRaw === '' ? null : parseHours(hoursRaw)
  if (hoursRaw !== '' && hours === null) return fail('Hodiny musí být číslo od 0 do 24.')

  const fromRaw = text(r.fromTime)
  const fromTime = fromRaw === '' ? null : parseTime(fromRaw)
  if (fromRaw !== '' && fromTime === null) return fail('Čas musí být ve tvaru HH:MM.')

  const toRaw = text(r.toTime)
  const toTime = toRaw === '' ? null : parseTime(toRaw)
  if (toRaw !== '' && toTime === null) return fail('Čas musí být ve tvaru HH:MM.')

  const place = text(r.place) || null
  if (place !== null && delka(place) > 200) return fail('Místo může mít nejvýše 200 znaků.')

  const note = text(r.note) || null
  if (note !== null && delka(note) > 500) return fail('Poznámka může mít nejvýše 500 znaků.')

  // Práce je jediný typ, kde jsou hodiny i místo povinné.
  if (kind === 'WORK' && (hours === null || place === null)) {
    return fail('Při práci vyplň počet hodin i místo.')
  }

  const parsed = entrySchema.safeParse({ day, kind, hours, fromTime, toTime, place, note })
  if (!parsed.success) return fail('Zápis dne má neplatné údaje.')
  return { ok: true, value: parsed.data }
}
