// Firemní CSV pro český Excel: BOM, středník, CRLF, ochrana před vzorci — stejná pravidla jako csv.ts. Nic nepočítá.

import { dayShort } from '@/lib/company-report'
import type { CompanyReport } from '@/lib/company-report'

const HLAVICKA = ['Jméno', 'Hodiny', 'Odpracované dny', 'Chybějící dny (počet)', 'Chybějící dny']

// Viz csv.ts: úvodní mezera před = + - @ tabulátor CR, ošetření PŘED uvozováním.
const bunka = (v: string) => {
  const text = /^[=+\-@\t\r]/.test(v) ? ` ${v}` : v
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCompanyCsv(r: CompanyReport): string {
  const radky = [
    HLAVICKA,
    ...r.rows.map((p) => [p.personName, p.totalHours, String(p.daysWorked), String(p.missingDays.length), p.missingDays.map(dayShort).join(', ')]),
    ['Celkem', r.totalHours, '', '', ''],
  ]
  return '﻿' + radky.map((x) => x.map(bunka).join(';') + '\r\n').join('')
}
