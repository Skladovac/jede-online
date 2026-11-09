// PDF výkazu, kreslené přímo knihovnou pdfkit (žádný prohlížeč). Čistý modul, nic nepočítá a neformátuje —
// jen kreslí texty z Report. Rozvržení (hlavička, podpisy, firma) čeká na vzor papírového výkazu.

import { existsSync } from 'node:fs'
import PDFDocument from 'pdfkit'
import type { Report } from './rows'

/** První existující TTF z kandidátů. Vestavěná Helvetica nemá české znaky, proto bez fontu raději spadneme. */
export function resolvePdfFont(
  candidates: string[] = [
    process.env.DOHAZKA_PDF_FONT ?? '',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:/Windows/Fonts/arial.ttf',
  ],
): string {
  const nalezen = candidates.find((c) => c && existsSync(c))
  if (!nalezen) {
    throw new Error(
      'Pro export do PDF chybí font s češtinou. Nainstalujte balíček fonts-dejavu-core (soubor DejaVuSans.ttf) nebo nastavte DOHAZKA_PDF_FONT na cestu k TTF fontu.',
    )
  }
  return nalezen
}

const OKRAJ = 40
const PISMO = 9
const MIN_RADEK = 16 // jedna stránka pojme i 31 dní, delší poznámky řádek jen zvětší
const ODSTUP_BUNKY = 4

// Součet šířek = 515 (A4 595 − 2 × 40)
const SLOUPCE = [
  { nazev: 'Datum', sirka: 62, pravo: false },
  { nazev: 'Den', sirka: 52, pravo: false },
  { nazev: 'Od', sirka: 34, pravo: false },
  { nazev: 'Do', sirka: 34, pravo: false },
  { nazev: 'Hodiny', sirka: 42, pravo: true },
  { nazev: 'Místo', sirka: 90, pravo: false },
  { nazev: 'Typ', sirka: 55, pravo: false },
  { nazev: 'Poznámka', sirka: 146, pravo: false },
]

export async function toPdf(report: Report): Promise<Buffer> {
  // Font hledáme dřív, než cokoli vykreslíme — chyba má být hned a česky.
  const font = resolvePdfFont()
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: OKRAJ, autoFirstPage: false, info: { Title: report.title } })
    const kusy: Buffer[] = []
    doc.on('data', (k: Buffer) => kusy.push(k))
    doc.on('end', () => resolve(Buffer.concat(kusy)))
    doc.on('error', reject)

    try {
      doc.registerFont('body', font)
      const sirka = SLOUPCE.reduce((s, c) => s + c.sirka, 0)

      const hlavickaTabulky = (y: number) => {
        doc.font('body').fontSize(PISMO).fillColor('#000')
        let x = OKRAJ
        for (const c of SLOUPCE) {
          doc.text(c.nazev, x + ODSTUP_BUNKY, y + 4, { width: c.sirka - 2 * ODSTUP_BUNKY, align: c.pravo ? 'right' : 'left', lineBreak: false })
          x += c.sirka
        }
        doc.moveTo(OKRAJ, y + 16).lineTo(OKRAJ + sirka, y + 16).lineWidth(1).strokeColor('#000').stroke()
        return y + 18
      }

      const novaStranka = () => {
        doc.addPage({ size: 'A4', layout: 'portrait', margin: OKRAJ })
        return OKRAJ
      }

      let y = novaStranka()
      doc.font('body').fontSize(16).fillColor('#000').text(report.title, OKRAJ, y, { width: sirka, lineBreak: false })
      y += 26
      doc.fontSize(11).text(`Jméno: ${report.personName}`, OKRAJ, y, { width: sirka })
      y += 16
      doc.text(`Období: ${report.periodLabel}`, OKRAJ, y, { width: sirka })
      y += 28
      y = hlavickaTabulky(y)
      const spodek = doc.page.height - OKRAJ

      for (const r of report.rows) {
        const hodnoty = [r.dayKey, r.weekday, r.fromTime, r.toTime, r.hours, r.place, r.kind, r.note]
        doc.fontSize(PISMO)
        const vyska = Math.max(
          MIN_RADEK,
          ...SLOUPCE.map((c, i) => doc.heightOfString(hodnoty[i], { width: c.sirka - 2 * ODSTUP_BUNKY }) + 6),
        )
        if (y + vyska > spodek - 40) {
          y = hlavickaTabulky(novaStranka())
        }
        let x = OKRAJ
        SLOUPCE.forEach((c, i) => {
          doc.text(hodnoty[i], x + ODSTUP_BUNKY, y + 3, { width: c.sirka - 2 * ODSTUP_BUNKY, align: c.pravo ? 'right' : 'left' })
          x += c.sirka
        })
        doc.moveTo(OKRAJ, y + vyska).lineTo(OKRAJ + sirka, y + vyska).lineWidth(0.3).strokeColor('#999').stroke()
        y += vyska
      }

      // Součet vždy celý pohromadě na posledním listu.
      if (y + 44 > spodek) y = novaStranka()
      y += 8
      doc.fontSize(11).fillColor('#000')
      doc.text(`Celkem hodin: ${report.totalHours}`, OKRAJ, y, { width: sirka, lineBreak: false })
      doc.text(`Odpracovaných dnů: ${report.daysWorked}`, OKRAJ, y + 16, { width: sirka, lineBreak: false })
      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}
