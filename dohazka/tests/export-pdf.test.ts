import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolvePdfFont, toPdf } from '@/lib/export/pdf'
import type { Report } from '@/lib/export/rows'

const empty: Report = { title: 'Výkaz odpracovaných hodin', personName: 'Jan Novák', periodLabel: 'listopad 2026', rows: [], totalHours: '0', daysWorked: 0 }

describe('resolvePdfFont', () => {
  it('vybere existující cestu', () => {
    expect(existsSync(resolvePdfFont())).toBe(true)
  })
  it('bez fontu řekne proč, místo aby spadl na undefined', () => {
    expect(() => resolvePdfFont(['/takovy/font/neexistuje.ttf'])).toThrow(/font/i)
  })
})

describe('toPdf', () => {
  it('vyrobí PDF s českou diakritikou', async () => {
    const buf = await toPdf({ ...empty, rows: [{ dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '', toTime: '', hours: '8,5', place: 'Zlín', kind: '', note: '' }], totalHours: '8,5', daysWorked: 1 })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(1000)
    // Vestavěná Helvetica nemá češtinu; kdyby se použila, diakritika by se tiše rozsypala.
    const text = buf.toString('latin1')
    expect(text).not.toContain('Helvetica')
    // Vložený font je TTF z disku (Arial/DejaVu), ne jeden ze standardních 14.
    expect(text).toMatch(/\/FontFile2/)
  })
  it('prázdný měsíc vyrobí PDF s hlavičkou, ne chybu', async () => {
    const buf = await toPdf(empty)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
