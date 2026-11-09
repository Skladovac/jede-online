// Skutečný .xlsx (zip), ne CSV s jinou příponou. Rozvržení: 1 = název/jméno/období, 2 = prázdný,
// 3 = hlavička, 4+ = data, nakonec součtový řádek. Nic nepočítá.

import ExcelJS from 'exceljs'
import type { Report } from './rows'

const HLAVICKA = ['Datum', 'Den', 'Od', 'Do', 'Hodiny', 'Místo', 'Typ', 'Poznámka']
const HODINY_FORMAT = '0.00'
const SIRKY = [12, 12, 8, 8, 9, 22, 12, 40]

export async function toXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Výkaz')

  ws.getCell('A1').value = `${report.title} – ${report.personName}, ${report.periodLabel}`
  ws.getCell('A1').font = { bold: true, size: 13 }

  const hlavicka = ws.getRow(3)
  hlavicka.values = HLAVICKA
  hlavicka.font = { bold: true }

  for (const r of report.rows) {
    // Hodiny jako číslo (ne český text), ať v Excelu jde sloupec sečíst.
    const radek = ws.addRow([r.dayKey, r.weekday, r.fromTime, r.toTime, r.hoursValue, r.place, r.kind, r.note])
    radek.getCell(5).numFmt = HODINY_FORMAT
  }
  // Mezi řádky dat a součtem žádná mezera; addRow na prázdném listu s řádkem 3 pokračuje od 4.
  const soucet = ws.addRow(['Celkem', '', '', '', report.totalHoursValue, '', '', ''])
  soucet.font = { bold: true }
  soucet.getCell(5).numFmt = HODINY_FORMAT
  const dny = ws.addRow(['Odpracovaných dnů', '', '', '', report.daysWorked, '', '', ''])
  dny.font = { bold: true }
  dny.getCell(5).numFmt = '0'

  SIRKY.forEach((w, i) => (ws.getColumn(i + 1).width = w))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
