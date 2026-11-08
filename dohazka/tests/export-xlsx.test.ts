import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { toXlsx } from '@/lib/export/xlsx'
import type { Report } from '@/lib/export/rows'

const empty: Report = { title: 'Výkaz odpracovaných hodin', personName: 'Jan Novák', periodLabel: 'listopad 2026', rows: [], totalHours: '0', daysWorked: 0 }

describe('toXlsx', () => {
  it('vyrobí skutečný xlsx, ne csv s jinou příponou', async () => {
    const buf = await toXlsx({ ...empty, rows: [{ dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '', toTime: '', hours: '8,5', place: 'Zlín', kind: '', note: '' }], totalHours: '8,5', daysWorked: 1 })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK') // zip
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer) // typy exceljs mají vlastní Buffer
    const ws = wb.getWorksheet('Výkaz')!
    expect(ws.getCell('A1').value).toContain('Jan Novák')
    expect(ws.getCell('F4').value).toBe('Zlín')
    expect(ws.getCell('E5').value).toBe('8,5')
    expect(ws.getCell('A6').value).toBe('Odpracovaných dnů')
    expect(ws.getCell('E6').value).toBe('1')
  })
  it('prázdný měsíc nespadne', async () => {
    const buf = await toXlsx(empty)
    expect(buf.length).toBeGreaterThan(0)
  })
})
