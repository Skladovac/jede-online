// Firemní CSV pro český Excel: BOM, středník, CRLF, ochrana před vzorci — stejná pravidla jako csv.ts. Nic nepočítá.

import { ddmmyyyy } from '@/lib/export/rows'
import type { CompanyReport } from '@/lib/company-report'

const HLAVICKA = ['Jméno', 'Hodiny', 'Odpracované dny', 'Dny bez záznamu (počet)', 'Dny bez záznamu']

// Viz csv.ts: úvodní mezera před = + - @ tabulátor CR, ošetření PŘED uvozováním.
const bunka = (v: string) => {
  const text = /^[=+\-@\t\r]/.test(v) ? ` ${v}` : v
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// Jediný den "4. 11." by český Excel přečetl jako datum. Rok to nezaručí sám, proto i úvodní mezera: buňka je text.
const dnyBezZaznamu = (dny: string[]) => (dny.length === 0 ? '' : ' ' + dny.map(ddmmyyyy).join(', '))

export function toCompanyCsv(r: CompanyReport): string {
  const radky = [
    HLAVICKA,
    ...r.rows.map((p) => [p.personName, p.totalHours, String(p.daysWorked), String(p.missingDays.length), dnyBezZaznamu(p.missingDays)]),
    ['Celkem', r.totalHours, '', '', ''],
  ]
  return '﻿' + radky.map((x) => x.map(bunka).join(';') + '\r\n').join('')
}
