// Měsíční přehled: čistá funkce bez Prismy a bez `server-only`, aby šla testovat přímo v Node.
// Hodiny sem musí přijít už jako `number` (Decimal z Prismy převádí stránka).

import { dayKeysInRange } from '@/lib/date'
import type { EntryKindValue } from '@/lib/entry'

export type EntryRow = {
  id: string
  kind: EntryKindValue
  hours: number | null
  fromTime: string | null
  toTime: string | null
  place: string | null
  note: string | null
}

export type MonthRow = {
  dayKey: string
  entries: EntryRow[]
  hours: number
  // filled = má záznam, empty = bez záznamu (není chyba), before-start = před začátkem zapisování
  state: 'filled' | 'empty' | 'before-start'
}

/** Součet hodin v celých setinách, aby 7,7 + 0,1 + 0,2 vyšlo přesně 8 a ne 7,999…. */
function sectiHodiny(hodiny: (number | null)[]): number {
  const setiny = hodiny.reduce<number>((soucet, h) => soucet + (h === null ? 0 : Math.round(h * 100)), 0)
  return setiny / 100
}

export function buildMonth(args: {
  fromKey: string
  toKey: string
  tracksFromKey: string
  entries: (EntryRow & { dayKey: string })[]
}): { rows: MonthRow[]; totalHours: number; daysWorked: number } {
  const poDnech = new Map<string, EntryRow[]>()
  for (const { dayKey, ...zapis } of args.entries) {
    const v = poDnech.get(dayKey)
    if (v) v.push(zapis)
    else poDnech.set(dayKey, [zapis])
  }

  const rows: MonthRow[] = dayKeysInRange(args.fromKey, args.toKey)
    .reverse() // nejnovější první
    .map((dayKey) => {
      const entries = poDnech.get(dayKey) ?? []
      // Klíče jsou ISO data, takže řetězcové porovnání je i chronologické.
      // Den se záznamem se nikdy neskryje, i kdyby ležel před tracksFrom — jinak by součet
      // počítal hodiny, které v seznamu nejsou vidět.
      const state: MonthRow['state'] =
        entries.length > 0 ? 'filled' : dayKey < args.tracksFromKey ? 'before-start' : 'empty'
      return { dayKey, entries, hours: sectiHodiny(entries.map((x) => x.hours)), state }
    })

  return {
    rows,
    totalHours: sectiHodiny(rows.map((r) => r.hours)),
    daysWorked: rows.filter((r) => r.entries.some((x) => x.kind === 'WORK')).length,
  }
}
