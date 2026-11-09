// Převod měsíčního přehledu na hotový výkaz: všechny hodnoty už jsou české texty, prázdno je ''.
// Jediné místo, které něco počítá/formátuje — csv.ts, xlsx.ts a PDF jen vyrábějí soubory.
// Čistý modul bez `server-only`.

import { formatHours, parseDayKey } from '@/lib/date'
import { KIND_LABEL } from '@/lib/entry'
import type { buildMonth } from '@/lib/month'

export type ReportRow = {
  dayKey: string
  weekday: string
  fromTime: string
  toTime: string
  hours: string
  /** Číselná hodnota pro XLSX (CSV a PDF ji ignorují); null = bez hodin. */
  hoursValue: number | null
  place: string
  kind: string
  note: string
}

export type Report = {
  title: string
  /** Název firmy z Organization.reportName; odlišuje výkazy téhož člověka z různých firem. */
  orgName: string
  personName: string
  periodLabel: string
  rows: ReportRow[]
  totalHours: string
  /** Číselný součet pro XLSX (CSV a PDF ho ignorují). */
  totalHoursValue: number
  daysWorked: number
}

// Hodnota dne je UTC půlnoc (parseDayKey), proto i formátování v UTC — jinak by pátek vyšel jako čtvrtek.
const dnyFormat = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', timeZone: 'UTC' })
const mesicFormat = new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const ddmmyyyy = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

export function buildReport(args: {
  orgName: string
  personName: string
  fromKey: string
  toKey: string
  month: ReturnType<typeof buildMonth>
}): Report {
  const { fromKey, toKey, month } = args

  const rows: ReportRow[] = month.rows
    .filter((r) => r.entries.length > 0) // dny bez záznamu a before-start do výkazu nepatří
    .reverse() // buildMonth řadí nejnovější první, výkaz jde chronologicky
    .flatMap((r) =>
      r.entries.map((e) => ({
        dayKey: r.dayKey,
        weekday: dnyFormat.format(parseDayKey(r.dayKey)),
        fromTime: e.fromTime ?? '',
        toTime: e.toTime ?? '',
        hours: e.hours === null ? '' : formatHours(e.hours),
        hoursValue: e.hours,
        place: e.place ?? '',
        kind: e.kind === 'WORK' ? '' : KIND_LABEL[e.kind],
        note: e.note ?? '',
      })),
    )

  // Období je pojmenované po měsíci, ve kterém končí (viz periodRange). Mimo kalendářní měsíc přidáme rozsah.
  const mesic = mesicFormat.format(parseDayKey(toKey))
  const periodLabel = fromKey.endsWith('-01') ? mesic : `${mesic} (${ddmmyyyy(fromKey)} – ${ddmmyyyy(toKey)})`

  return {
    title: 'Výkaz odpracovaných hodin',
    orgName: args.orgName,
    personName: args.personName,
    periodLabel,
    rows,
    totalHours: formatHours(month.totalHours),
    totalHoursValue: month.totalHours,
    daysWorked: month.daysWorked,
  }
}
