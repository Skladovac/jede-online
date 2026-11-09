// Firemní .xlsx: řádek 1 = hlavička, 2+ = lidé, pak součet. Hodiny jsou čísla (ne text), ať jde sloupec sečíst. Nic nepočítá.

import ExcelJS from 'exceljs'
import { dayShort } from '@/lib/company-report'
import type { CompanyReport } from '@/lib/company-report'

const HLAVICKA = ['Jméno', 'Hodiny', 'Odpracované dny', 'Chybějící dny (počet)', 'Chybějící dny']
const HODINY_FORMAT = '0.00'
const SIRKY = [28, 10, 16, 20, 50]

export async function toCompanyXlsx(r: CompanyReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Firma')

  const hlavicka = ws.getRow(1)
  hlavicka.values = HLAVICKA
  hlavicka.font = { bold: true }

  for (const p of r.rows) {
    const radek = ws.addRow([p.personName, p.totalHoursValue, p.daysWorked, p.missingDays.length, p.missingDays.map(dayShort).join(', ')])
    radek.getCell(2).numFmt = HODINY_FORMAT
  }
  const soucet = ws.addRow(['Celkem', r.totalHoursValue, '', '', ''])
  soucet.font = { bold: true }
  soucet.getCell(2).numFmt = HODINY_FORMAT

  // Firma a období pod tabulkou, aby data zůstala od prvního řádku.
  ws.addRow([])
  ws.addRow([`${r.orgName}, ${r.periodLabel}`])

  SIRKY.forEach((w, i) => (ws.getColumn(i + 1).width = w))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
