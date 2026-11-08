// CSV pro český Excel: středník, CRLF a BOM (bez něj se rozsype diakritika). Nic nepočítá.

import type { Report } from './rows'

const HLAVICKA = ['Datum', 'Den', 'Od', 'Do', 'Hodiny', 'Místo', 'Typ', 'Poznámka']

// Hodnota začínající = + - @ tabulátorem nebo CR by se v Excelu stala vzorcem (#NAME?), proto předsadíme apostrof.
// Ošetření jde PŘED uvozováním, aby uvozovky obalily už výslednou hodnotu.
const bunka = (v: string) => {
  const text = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(report: Report): string {
  const radky = [
    HLAVICKA,
    ...report.rows.map((r) => [r.dayKey, r.weekday, r.fromTime, r.toTime, r.hours, r.place, r.kind, r.note]),
    ['Celkem', '', '', '', report.totalHours, '', '', ''],
    ['Odpracovaných dnů', '', '', '', String(report.daysWorked), '', '', ''],
  ]
  return '﻿' + radky.map((r) => r.map(bunka).join(';') + '\r\n').join('')
}
