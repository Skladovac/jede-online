import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { toCompanyCsv } from '@/lib/export/company-csv'
import { toCompanyXlsx } from '@/lib/export/company-xlsx'
import type { CompanyReport } from '@/lib/company-report'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
}))
const auth = vi.hoisted(() => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth', () => auth)
const db = vi.hoisted(() => ({ membership: { findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { GET } from '@/app/api/export/firma/[format]/route'
import { loadCompanyPeople } from '@/lib/company-data'

const report = (over: Partial<CompanyReport> = {}): CompanyReport => ({
  orgName: 'Stavby Novák s.r.o.',
  periodLabel: 'listopad 2026',
  rows: [
    { personName: 'Jan Novák', totalHours: '16,5', totalHoursValue: 16.5, daysWorked: 2, missingDays: ['2026-11-04', '2026-11-05'] },
    { personName: 'Eva Svobodová', totalHours: '8', totalHoursValue: 8, daysWorked: 1, missingDays: [] },
  ],
  totalHours: '24,5',
  totalHoursValue: 24.5,
  ...over,
})
const jedna = (personName: string): CompanyReport['rows'] => [{ personName, totalHours: '1', totalHoursValue: 1, daysWorked: 1, missingDays: [] }]

describe('toCompanyXlsx', () => {
  it('má hodiny jako čísla, ne text', async () => {
    const buf = await toCompanyXlsx(report())
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer)
    const ws = wb.getWorksheet('Firma')!
    expect(ws.getCell('A1').value).toBe('Jméno')
    expect(ws.getCell('A2').value).toBe('Jan Novák')
    expect(ws.getCell('B2').value).toBe(16.5)
    expect(ws.getCell('B2').type).toBe(ExcelJS.ValueType.Number)
    expect(ws.getCell('B2').numFmt).toBe('0.00')
    expect(ws.getCell('C2').type).toBe(ExcelJS.ValueType.Number)
    expect(ws.getCell('D2').value).toBe(2)
    expect(ws.getCell('E2').value).toBe('4. 11. 2026 (st), 5. 11. 2026 (čt)')
    expect(ws.getCell('A4').value).toBe('Celkem')
    expect(ws.getCell('B4').value).toBe(24.5)
    expect(ws.getCell('B4').type).toBe(ExcelJS.ValueType.Number)
  })
  it('prázdná firma nespadne', async () => {
    const buf = await toCompanyXlsx(report({ rows: [], totalHours: '0', totalHoursValue: 0 }))
    expect(buf.length).toBeGreaterThan(100)
  })
})

describe('toCompanyCsv', () => {
  it('má BOM, středníky a CRLF', () => {
    const csv = toCompanyCsv(report())
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Jméno;Hodiny;Odpracované dny;Dny bez záznamu (počet);Dny bez záznamu\r\n')
    expect(csv).toContain('Jan Novák;16,5;2;2;4. 11. 2026 (st), 5. 11. 2026 (čt)\r\n')
    expect(csv).toContain('Eva Svobodová;8;1;0;\r\n')
    expect(csv).toContain('Celkem;24,5;;;\r\n')
  })
  it('chrání vzorce stejně jako výkaz jednotlivce', () => {
    for (const zlo of ['=1+1', '+420', '-5', '@SUM(A1)', '\tx', '\rx']) {
      const csv = toCompanyCsv(report({ rows: jedna(zlo) }))
      // ošetření jde před uvozováním, takže hodnotu s CR obalí uvozovky
      const radek = csv.slice(csv.indexOf('\r\n') + 2).replace(/^"/, '')
      expect(radek.startsWith(' ' + zlo.slice(0, 1))).toBe(true)
    }
  })
  it('jediný den bez záznamu nese rok i den v týdnu, aby ho Excel nečetl jako datum', () => {
    const csv = toCompanyCsv(report({ rows: [{ ...jedna('X')[0], missingDays: ['2026-11-04'] }] }))
    expect(csv).toContain('X;1;1;1;4. 11. 2026 (st)\r\n')
  })
  it('uvozuje jméno se středníkem a uvozovkou', () => {
    const csv = toCompanyCsv(report({ rows: jedna('Novák; "Jan"') }))
    expect(csv).toContain('"Novák; ""Jan"""')
  })
})

// --- data a trasa: dvě firmy v jedné „databázi“ -----------------------------------------------------------------

const den = (d: string) => new Date(`${d}T00:00:00Z`)
const zapis = (id: string, day: string, hours: number) => ({
  id, day: den(day), kind: 'WORK', hours: String(hours), fromTime: null, toTime: null, place: null, note: null, createdAt: den(day),
})
const org = (id: string) => ({ id, name: id, reportName: `Firma ${id}`, periodStartDay: 1, remindHour: 19 })
const clen = (id: string, orgId: string, role: string, name: string, active = true, entries: ReturnType<typeof zapis>[] = []) => ({
  id, orgId, role, active, userId: `u-${id}`, tracksFrom: den('2026-11-01'), createdAt: den('2026-01-01'),
  org: org(orgId), user: { name }, entries,
})
const DATA = [
  clen('m-a-emp', 'A', 'EMPLOYEE', 'Adam Zaměstnanec', true, [zapis('e1', '2026-11-02', 8)]),
  clen('m-a-own', 'A', 'OWNER', 'Olga Správkyně', true, [zapis('e2', '2026-11-02', 5)]),
  clen('m-a-acc', 'A', 'ACCOUNTANT', 'Ucta Účetní'),
  clen('m-a-old', 'A', 'EMPLOYEE', 'Odešel Bývalý', false, [zapis('e3', '2026-11-03', 3)]),
  clen('m-a-old0', 'A', 'EMPLOYEE', 'Odešel Bezhodin', false),
  clen('m-b-emp', 'B', 'EMPLOYEE', 'Cizí Zaměstnanec', true, [zapis('e4', '2026-11-02', 99)]),
]

type Where = { orgId?: string; role?: string; userId?: string }
// Věrná náhrada databáze: filtruje podle orgId a role z `where` (a jen podle nich) a podle „aktivní nebo má záznam“.
// Chybí-li orgId nebo role v dotazu, cizí a nezaměstnaní lidé v odpovědi zůstanou — a testy spadnou.
const nastavDb = (mojeRole: string, mojeOrg = 'A') => {
  auth.getCurrentUser.mockResolvedValue({ id: 'u-me', name: 'Já', isSuperAdmin: false })
  const moje = { id: 'm-me', orgId: mojeOrg, role: mojeRole, active: true, userId: 'u-me', tracksFrom: den('2026-01-01'), createdAt: den('2026-01-01'), org: org(mojeOrg), user: { name: 'Já' }, entries: [] }
  db.membership.findMany.mockImplementation(async ({ where }: { where: Where }) => {
    if (where.userId === 'u-me') return [moje]
    return DATA.filter((m) => (where.orgId === undefined || m.orgId === where.orgId) && (m.active || m.entries.length > 0))
  })
}
const dotazyNaFirmu = () => db.membership.findMany.mock.calls.filter(([a]) => a.where.userId === undefined)
const zadost = (format: string, period = '2026-11') =>
  GET(new Request(`http://x/api/export/firma/${format}?period=${period}`), { params: Promise.resolve({ format }) })

describe('loadCompanyPeople', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nastavDb('ACCOUNTANT')
  })
  it('vrací členy vlastní firmy všech rolí, nikdy cizí firmu', async () => {
    const lide = await loadCompanyPeople('A', '2026-11-01', '2026-11-30')
    expect(lide.map((l) => l.personName)).toEqual(['Adam Zaměstnanec', 'Odešel Bývalý', 'Olga Správkyně', 'Ucta Účetní'])
    expect(db.membership.findMany.mock.calls[0][0].where).toMatchObject({ orgId: 'A' })
  })
  it('díry se hledají jen aktivním zaměstnancům, ne správci ani účetní', async () => {
    const lide = await loadCompanyPeople('A', '2026-11-01', '2026-11-30')
    const gaps = Object.fromEntries(lide.map((l) => [l.personName, l.trackGaps]))
    expect(gaps).toEqual({ 'Adam Zaměstnanec': true, 'Odešel Bývalý': false, 'Olga Správkyně': false, 'Ucta Účetní': false })
  })
  it('neaktivní s hodinami v období zůstane (patří do mezd), ale bez hledání mezer', async () => {
    const lide = await loadCompanyPeople('A', '2026-11-01', '2026-11-30')
    const stary = lide.find((l) => l.personName === 'Odešel Bývalý')!
    expect(stary.month.totalHours).toBe(3)
    expect(stary.trackGaps).toBe(false)
    expect(lide.find((l) => l.personName === 'Adam Zaměstnanec')!.trackGaps).toBe(true)
  })
})

describe('GET /api/export/firma/[format]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('zaměstnanec je přesměrován a firemní data se vůbec nečtou', async () => {
    nastavDb('EMPLOYEE')
    await expect(zadost('csv')).rejects.toThrow('NEXT_REDIRECT:/')
    expect(dotazyNaFirmu()).toHaveLength(0)
  })
  it('nepřihlášený jde na přihlášení', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    await expect(zadost('csv')).rejects.toThrow('NEXT_REDIRECT:/prihlaseni')
  })
  it('PDF vrací 400 s českou hláškou, i pro účetní, a nic nečte', async () => {
    nastavDb('ACCOUNTANT')
    const r = await zadost('pdf')
    expect(r.status).toBe(400)
    expect((await r.json()).error).toMatch(/PDF/)
    expect(dotazyNaFirmu()).toHaveLength(0)
  })
  it('PDF zaměstnanci: nejdřív oprávnění (přesměrování), ne 400', async () => {
    nastavDb('EMPLOYEE')
    await expect(zadost('pdf')).rejects.toThrow('NEXT_REDIRECT:/')
  })
  it('neznámý formát a špatné období jsou 400', async () => {
    nastavDb('OWNER')
    expect((await zadost('docx')).status).toBe(400)
    expect((await zadost('csv', '2026-13')).status).toBe(400)
    // rok 0050 by Date.UTC přemapoval na 1950 a období by se rozjelo (pád na 500)
    expect((await zadost('csv', '0050-11')).status).toBe(400)
    expect((await zadost('csv', '1999-11')).status).toBe(400)
    expect((await zadost('csv', '2101-11')).status).toBe(400)
  })
  it('CSV účetní obsahuje zaměstnance své firmy a nikoho z cizí', async () => {
    nastavDb('ACCOUNTANT')
    const r = await zadost('csv')
    expect(r.status).toBe(200)
    const bajty = Buffer.from(await r.clone().arrayBuffer())
    expect([...bajty.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // BOM; text() ho při dekódování odstraní
    const csv = await r.text()
    expect(csv).toContain('Adam Zaměstnanec;8;1;')
    expect(csv).toContain('Odešel Bývalý;3;1;0;') // neaktivní s hodinami, bez falešných mezer
    expect(csv).not.toContain('Odešel Bezhodin')
    expect(csv).not.toContain('Cizí Zaměstnanec')
    // správce s hodinami je v mzdách a nemá vypsané díry (počet 0, seznam prázdný)
    expect(csv).toContain('Olga Správkyně;5;1;0;\r\n')
    expect(csv).toContain('Ucta Účetní;0;0;0;\r\n')
    expect(csv).toContain('Celkem;16;') // 8 + 5 + 3, ne 99 z firmy B
    expect(r.headers.get('Content-Disposition')).toContain('Firma-A')
  })
  it('XLSX správce je skutečný xlsx jen s lidmi své firmy', async () => {
    nastavDb('OWNER')
    const r = await zadost('xlsx')
    expect(r.status).toBe(200)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(await r.arrayBuffer()) as unknown as ExcelJS.Buffer)
    const jmena = wb.getWorksheet('Firma')!.getColumn(1).values.filter(Boolean)
    expect(jmena).toContain('Adam Zaměstnanec')
    expect(jmena).not.toContain('Cizí Zaměstnanec')
    expect(jmena).toContain('Olga Správkyně')
  })
  it('aktivní firma je ta z členství, ne z jiné: uživatel firmy B dostane B', async () => {
    nastavDb('OWNER', 'B')
    const csv = await (await zadost('csv')).text()
    expect(csv).toContain('Cizí Zaměstnanec;99')
    expect(csv).not.toContain('Adam Zaměstnanec')
  })
})
