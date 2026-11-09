import { existsSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { resolvePdfFont, toPdf } from '@/lib/export/pdf'
import type { Report } from '@/lib/export/rows'

const empty: Report = { title: 'Výkaz odpracovaných hodin', orgName: 'Stavby Novák s.r.o.', personName: 'Jan Novák', periodLabel: 'listopad 2026', rows: [], totalHours: '0', totalHoursValue: 0, daysWorked: 0 }

// Vytáhne z PDF textovou vrstvu i se souřadnicemi: rozbalí streamy, přečte ToUnicode mapu vloženého fontu
// a každý kus textu (operátor Tm + TJ) vrátí jako { x, y, text }. Bez externích závislostí.
function textovaVrstva(buf: Buffer): { x: number; y: number; text: string }[] {
  const streamy: string[] = []
  for (const m of buf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      streamy.push(inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'))
    } catch {
      /* ne každý stream je komprimovaný (např. font) */
    }
  }
  const cmap = streamy.find((t) => t.includes('beginbfrange'))
  const znaky = [...(cmap?.match(/\[([^\]]*)\]/)?.[1].matchAll(/<([0-9a-f]{4})>/g) ?? [])].map((h) => String.fromCharCode(parseInt(h[1], 16)))
  const kusy: { x: number; y: number; text: string }[] = []
  for (const t of streamy.filter((s) => s.includes(' Tm'))) {
    for (const m of t.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm[\s\S]*?\[([^\]]*)\] TJ/g)) {
      const hex = [...m[3].matchAll(/<([0-9a-f]+)>/g)].map((h) => h[1]).join('')
      let text = ''
      for (let i = 0; i < hex.length; i += 4) text += znaky[parseInt(hex.slice(i, i + 4), 16)] ?? '?'
      kusy.push({ x: Number(m[1]), y: Number(m[2]), text })
    }
  }
  return kusy
}

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
    const buf = await toPdf({ ...empty, rows: [{ dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '', toTime: '', hours: '8,5', hoursValue: 8.5, place: 'Zlín', kind: '', note: '' }], totalHours: '8,5', totalHoursValue: 8.5, daysWorked: 1 })
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
  it('hodnoty jednoho dne jsou na jednom řádku (datum, hodiny i typ patří k sobě)', async () => {
    // Každá buňka nese číslo svého řádku; dovolená je jen na řádku 2, řádek 3 má dlouhou poznámku (zalomí se).
    const rows = [1, 2, 3, 4].map((i) => ({
      dayKey: `D${i}`, weekday: `W${i}`, fromTime: `F${i}`, toTime: `T${i}`, hours: `H${i}`, hoursValue: i, place: `P${i}`,
      kind: i === 2 ? 'Dovolená' : '', note: i === 3 ? `N${i} ` + 'dlouhá poznámka '.repeat(12) : `N${i}`,
    }))
    const kusy = textovaVrstva(await toPdf({ ...empty, rows, totalHours: '1', daysWorked: 4 }))
    // Dohledání buňky podle textu; y má být u všech buněk řádku shodné.
    const yBunky = (text: string) => {
      const nalezene = kusy.filter((k) => k.text.startsWith(text))
      expect(nalezene, text).toHaveLength(1)
      return nalezene[0].y
    }
    for (const i of [1, 2, 3, 4]) {
      const y = yBunky(`D${i}`)
      for (const p of ['W', 'F', 'T', 'H', 'P', 'N']) expect(yBunky(`${p}${i}`), `${p}${i}`).toBe(y)
    }
    expect(yBunky('Dovolená')).toBe(yBunky('D2'))
    // Řádky jdou shora dolů (y v PDF klesá) a netvoří dvojice.
    expect(yBunky('D1')).toBeGreaterThan(yBunky('D2'))
    expect(yBunky('D2')).toBeGreaterThan(yBunky('D3'))
    expect(yBunky('D3')).toBeGreaterThan(yBunky('D4'))
  })
})
