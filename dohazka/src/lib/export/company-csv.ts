// Firemní CSV pro český Excel: BOM, středník, CRLF, ochrana před vzorci — stejná pravidla jako csv.ts. Nic nepočítá.

import { missingDayLabel, type CompanyReport } from '@/lib/company-report'

const HLAVICKA = ['Jméno', 'Hodiny', 'Odpracované dny', 'Dny bez záznamu (počet)', 'Dny bez záznamu']

// Viz csv.ts: úvodní mezera před = + - @ tabulátor CR, ošetření PŘED uvozováním.
const bunka = (v: string) => {
  const text = /^[=+\-@\t\r]/.test(v) ? ` ${v}` : v
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// Tvar "4. 11. 2026 (st)": závorka na konci dělá z buňky text, který Excel jako datum nepřečte (úvodní mezeru nespoléháme).
const dnyBezZaznamu = (dny: string[]) => dny.map(missingDayLabel).join(', ')

export function toCompanyCsv(r: CompanyReport): string {
  const radky = [
    HLAVICKA,
    ...r.rows.map((p) => [p.personName, p.totalHours, String(p.daysWorked), String(p.missingDays.length), dnyBezZaznamu(p.missingDays)]),
    ['Celkem', r.totalHours, '', '', ''],
  ]
  return '﻿' + radky.map((x) => x.map(bunka).join(';') + '\r\n').join('')
}
