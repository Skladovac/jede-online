import { describe, expect, it } from 'vitest'
import { toCsv } from '@/lib/export/csv'
import type { Report } from '@/lib/export/rows'

const report = (rows: Report['rows']): Report => ({
  title: 'Výkaz odpracovaných hodin',
  personName: 'Jan Novák',
  periodLabel: 'listopad 2026',
  rows,
  totalHours: rows.length ? '16,5' : '0',
  totalHoursValue: rows.length ? 16.5 : 0,
  daysWorked: rows.length,
})

describe('toCsv', () => {
  const row = { dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '07:00', toTime: '15:30', hours: '8,5', hoursValue: 8.5, place: 'Zlín', kind: '', note: '' }
  it('má BOM, středníky a CRLF', () => {
    const csv = toCsv(report([row]))
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Datum;Den;Od;Do;Hodiny;Místo;Typ;Poznámka\r\n')
    expect(csv).toContain('2026-11-02;pondělí;07:00;15:30;8,5;Zlín;;\r\n')
  })
  it('uvozuje hodnoty se středníkem a uvozovkou', () => {
    const csv = toCsv(report([{ ...row, place: 'Zlín; Vsetín', note: 'řekl "ano"' }]))
    expect(csv).toContain('"Zlín; Vsetín"')
    expect(csv).toContain('"řekl ""ano"""')
  })
  it('součet nese hodiny i počet dnů', () => {
    const csv = toCsv(report([row]))
    expect(csv).toContain('Celkem;;;;16,5;;;\r\n')
    expect(csv).toContain('Odpracovaných dnů;;;;1;;;\r\n')
  })
  it('hodnoty začínající vzorcovým znakem dostanou úvodní mezeru', () => {
    for (const znak of ['-', '+', '=', '@']) {
      expect(toCsv(report([{ ...row, note: `${znak}dovolená` }]))).toContain(`; ${znak}dovolená\r\n`)
    }
    expect(toCsv(report([{ ...row, note: '\tx' }]))).toContain("; \tx\r\n")
  })
  it('vzorcový znak i středník dohromady: ošetření a uvozovky', () => {
    expect(toCsv(report([{ ...row, note: '=a;b "x"' }]))).toContain(`" =a;b ""x"""`)
  })
  it('poznámka s koncem řádku se uzavře do uvozovek a řádek zůstane celý', () => {
    expect(toCsv(report([{ ...row, note: 'a\nb' }]))).toContain('"a\nb"\r\n')
  })
  it('pomlčka uvnitř textu zůstane beze změny', () => {
    expect(toCsv(report([{ ...row, place: 'Zlín-Vsetín' }]))).toContain(';Zlín-Vsetín;')
  })
  it('prázdný měsíc má hlavičku a nulový součet', () => {
    const csv = toCsv(report([]))
    expect(csv).toContain('Datum;Den;Od;Do;Hodiny;Místo;Typ;Poznámka')
    expect(csv).toContain('0')
  })
})
