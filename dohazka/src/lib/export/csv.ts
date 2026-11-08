// CSV pro český Excel: středník, CRLF a BOM (bez něj se rozsype diakritika). Nic nepočítá.

import type { Report } from './rows'

const HLAVICKA = ['Datum', 'Den', 'Od', 'Do', 'Hodiny', 'Místo', 'Typ', 'Poznámka']

const bunka = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)

export function toCsv(report: Report): string {
  const radky = [
    HLAVICKA,
    ...report.rows.map((r) => [r.dayKey, r.weekday, r.fromTime, r.toTime, r.hours, r.place, r.kind, r.note]),
    ['Celkem', '', '', '', report.totalHours, '', '', ''],
  ]
  return '﻿' + radky.map((r) => r.map(bunka).join(';') + '\r\n').join('')
}
