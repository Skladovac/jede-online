// Firemní přehled: čistá funkce bez Prismy a bez `server-only`. Sčítá lidi v setinách (jako buildMonth),
// aby 7,7 + 0,1 + 0,2 vyšlo přesně 8. Formáty souborů řeší company-csv.ts a company-xlsx.ts.

import { formatHours, pragueDayKey } from '@/lib/date'
import { periodLabelFor } from '@/lib/export/rows'
import type { buildMonth } from '@/lib/month'

export type CompanyRow = {
  personName: string
  totalHours: string
  /** Číselná hodnota pro XLSX (CSV ji ignoruje). */
  totalHoursValue: number
  daysWorked: number
  /** Dny bez záznamu od začátku zapisování do včerejška (dnešek ještě neskončil), vzestupně jako "2026-11-03". Budoucí dny sem nepatří. */
  missingDays: string[]
}

export type CompanyReport = {
  orgName: string
  periodLabel: string
  rows: CompanyRow[]
  totalHours: string
  totalHoursValue: number
}

const setiny = (h: number) => Math.round(h * 100)

export function buildCompanyReport(args: {
  orgName: string
  fromKey: string
  toKey: string
  people: {
    personName: string
    month: ReturnType<typeof buildMonth>
    /** false = mezery se nehledají (už neaktivní člen: po odchodu by byly samé falešné). Výchozí true. */
    trackGaps?: boolean
  }[]
  /** Dnešek v pražském čase; jen pro testy, jinak se vezme z hodin. */
  todayKey?: string
}): CompanyReport {
  const today = args.todayKey ?? pragueDayKey(new Date())
  const rows: CompanyRow[] = args.people.map((p) => ({
    personName: p.personName,
    totalHours: formatHours(p.month.totalHours),
    totalHoursValue: p.month.totalHours,
    daysWorked: p.month.daysWorked,
    missingDays:
      p.trackGaps === false
        ? []
        : p.month.rows
            .filter((r) => r.state === 'empty' && r.dayKey < today)
            .map((r) => r.dayKey)
            .sort(),
  }))
  const total = rows.reduce((s, r) => s + setiny(r.totalHoursValue), 0) / 100
  return {
    orgName: args.orgName,
    periodLabel: periodLabelFor(args.fromKey, args.toKey),
    rows,
    totalHours: formatHours(total),
    totalHoursValue: total,
  }
}

/** "2026-11-03" → "3. 11." */
export const dayShort = (key: string) => {
  const [, m, d] = key.split('-').map(Number)
  return `${d}. ${m}.`
}
