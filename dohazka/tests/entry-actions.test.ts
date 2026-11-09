import { beforeEach, describe, expect, it, vi } from 'vitest'

// Akce importují server-only, org, prisma a next/cache; nahradíme je.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const ctx = vi.hoisted(() => ({ user: { id: 'u1' }, membership: { id: 'm1' }, org: { id: 'o1', periodStartDay: 1 }, role: 'OWNER', isSuperAdmin: false }))
// requireCan v ostré verzi při zamítnutí přesměruje (vyhodí NEXT_REDIRECT); mock to napodobí.
const requireCan = vi.hoisted(() => vi.fn())
vi.mock('@/lib/org', () => ({ requireOrgContext: vi.fn(async () => ctx), requireCan }))
// Volání, která proběhla uvnitř callbackové transakce (přes `tx`), v pořadí; testy tak poznají, co je v transakci.
const txVolani = vi.hoisted(() => [] as string[])
const db = vi.hoisted(() => ({
  entry: { deleteMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  entryChangeLog: { create: vi.fn() },
  membership: { findFirst: vi.fn() },
  periodLock: { findUnique: vi.fn() },
  // Pole operací (už vytvořené promisy) i interaktivní tvar s callbackem.
  $transaction: vi.fn(async (arg: unknown): Promise<unknown> => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(tx()) : Promise.all(arg as unknown[]))),
}))
// `tx` deleguje na stejné mocky jako `db`, jen si zapamatuje, co proběhlo uvnitř transakce.
const tx = () => {
  const obal = <T extends object>(jmeno: string, m: T) =>
    Object.fromEntries(Object.entries(m).map(([k, f]) => [k, (...a: unknown[]) => (txVolani.push(`${jmeno}.${k}`), (f as (...x: unknown[]) => unknown)(...a))]))
  return { entry: obal('entry', db.entry), entryChangeLog: obal('entryChangeLog', db.entryChangeLog) }
}
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { deleteEntry, deleteEntryFor, markDayOff, saveEntry, saveEntryFor } from '@/app/actions/entry'
import * as entryModule from '@/app/actions/entry'
import { can } from '@/lib/role'
import { Prisma } from '@prisma/client'

// Formulář dne posílá i `orgId` firmy, pro kterou se stránka vykreslila; bez jiné hodnoty je to firma z kontextu.
function form(o: Record<string, string>) {
  const f = new FormData()
  f.set('orgId', 'o1')
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

// Prisma where/data objekty se porovnávají přesně: žádný klíč `userId` nesmí zbýt a membershipId musí být přesně aktivní členství.
describe('zápisy jsou omezené členstvím, ne uživatelem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.entry.deleteMany.mockResolvedValue({ count: 1 })
    db.entry.create.mockResolvedValue({})
    db.entry.findFirst.mockResolvedValue({ day: new Date(Date.UTC(2026, 10, 9)) })
    db.periodLock.findUnique.mockResolvedValue(null)
  })

  it('saveEntry maže DAYOFF a zakládá záznam jen pod aktivním členstvím', async () => {
    const r = await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))
    expect(r).toEqual({ ok: true })
    const where = db.entry.deleteMany.mock.calls[0][0].where
    expect(where).toEqual({ membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 9)), kind: 'DAYOFF' })
    const data = db.entry.create.mock.calls[0][0].data
    expect(data.membershipId).toBe('m1')
    expect(data).not.toHaveProperty('userId')
  })

  it('deleteEntry maže cizí id jen v rámci aktivního členství', async () => {
    await deleteEntry('e42', 'o1')
    expect(db.entry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e42', membershipId: 'm1' } })
  })

  it('deleteEntry bez shody (záznam jiného členství) vrací chybu a nemaže', async () => {
    db.entry.findFirst.mockResolvedValue(null)
    expect(await deleteEntry('cizi', 'o1')).toEqual({ error: 'Smazání se nepodařilo.' })
    expect(db.entry.findFirst).toHaveBeenCalledWith({ where: { id: 'cizi', membershipId: 'm1' }, select: { day: true } })
    expect(db.entry.deleteMany).not.toHaveBeenCalled()
  })

  it('markDayOff maže a zakládá jen pod aktivním členstvím', async () => {
    await markDayOff('2026-11-09', 'o1')
    expect(db.entry.deleteMany.mock.calls[0][0].where).toEqual({ membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 9)) })
    const data = db.entry.create.mock.calls[0][0].data
    expect(data.membershipId).toBe('m1')
    expect(data).not.toHaveProperty('userId')
  })
})

// Uzávěrka platí na všechny včetně správce a super admina a hlídá ji akce, ne stránka.
describe('uzavřené období neprojde žádnou akcí dne', () => {
  const HLASKA = 'Měsíc je uzavřený, zápis už nejde změnit.'
  const zadnyZapis = () => {
    expect(db.entry.create).not.toHaveBeenCalled()
    expect(db.entry.deleteMany).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db.entry.deleteMany.mockResolvedValue({ count: 1 })
    db.entry.create.mockResolvedValue({})
    db.entry.findFirst.mockResolvedValue({ day: new Date(Date.UTC(2026, 10, 9)) })
    db.periodLock.findUnique.mockResolvedValue({ id: 'l1' })
    ctx.org.periodStartDay = 1
  })

  it('saveEntry: chyba a žádný zápis', async () => {
    expect(await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('deleteEntry: chyba a žádný zápis', async () => {
    expect(await deleteEntry('e1', 'o1')).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('markDayOff: chyba a žádný zápis', async () => {
    expect(await markDayOff('2026-11-09', 'o1')).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('čte se jen jedno období firmy, ne seznam', async () => {
    await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))
    expect(db.periodLock.findUnique).toHaveBeenCalledTimes(1)
    expect(db.periodLock.findUnique.mock.calls[0][0].where).toEqual({ orgId_periodKey: { orgId: 'o1', periodKey: '2026-11' } })
  })

  it('uzávěrka ctí periodStartDay firmy: při 16 patří 20. 11. do období 2026-12', async () => {
    ctx.org.periodStartDay = 16
    await markDayOff('2026-11-20', 'o1')
    expect(db.periodLock.findUnique.mock.calls[0][0].where.orgId_periodKey.periodKey).toBe('2026-12')
    db.periodLock.findUnique.mockClear()
    await markDayOff('2026-11-15', 'o1')
    expect(db.periodLock.findUnique.mock.calls[0][0].where.orgId_periodKey.periodKey).toBe('2026-11')
  })

  // Kód roli ani `isSuperAdmin` vůbec nečte, a přesně to tenhle test hlídá: až někdo
  // zkusí přidat výjimku „super admin smí i do uzavřeného", spadne tady. Nemazat jako nadbytečný.
  it('super admin uzávěrku neobejde', async () => {
    ctx.isSuperAdmin = true
    try {
      expect(await markDayOff('2026-11-09', 'o1')).toEqual({ error: HLASKA })
      zadnyZapis()
    } finally {
      ctx.isSuperAdmin = false
    }
  })

  it('otevřené období zapisuje normálně', async () => {
    db.periodLock.findUnique.mockResolvedValue(null)
    expect(await markDayOff('2026-11-09', 'o1')).toEqual({ ok: true })
    expect(db.entry.create).toHaveBeenCalledTimes(1)
  })
})

// Oprava cizího zápisu: správce firmy mění zápis jiného členství a zůstává po tom stopa.
describe('oprava cizího zápisu s historií změn', () => {
  const ZAMEK = 'Měsíc je uzavřený, zápis už nejde změnit.'
  const redirect = new Error('NEXT_REDIRECT')
  const zadnyZapis = () => {
    expect(db.entry.create).not.toHaveBeenCalled()
    expect(db.entry.deleteMany).not.toHaveBeenCalled()
    expect(db.entryChangeLog.create).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  }
  const radek = { id: 'e9', day: new Date(Date.UTC(2026, 10, 9)), kind: 'WORK', hours: { toString: () => '7.5' }, fromTime: '08:00', toTime: '15:30', place: 'Zlín', note: null }

  beforeEach(() => {
    vi.clearAllMocks()
    txVolani.length = 0
    requireCan.mockImplementation(async () => ctx)
    db.membership.findFirst.mockResolvedValue({ id: 'm2' })
    db.entry.deleteMany.mockResolvedValue({ count: 1 })
    db.entry.create.mockResolvedValue({})
    db.entry.findMany.mockResolvedValue([])
    db.entry.findFirst.mockResolvedValue(radek)
    db.entryChangeLog.create.mockResolvedValue({})
    db.periodLock.findUnique.mockResolvedValue(null)
  })

  it('saveEntryFor zapíše záznam cizímu členství a log before:null / after, changedById je ten, kdo mění', async () => {
    expect(await saveEntryFor('m2', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ ok: true })
    expect(requireCan).toHaveBeenCalledWith('editOthersEntry')
    expect(db.membership.findFirst).toHaveBeenCalledWith({ where: { id: 'm2', orgId: 'o1' }, select: { id: true } })
    expect(db.entry.create.mock.calls[0][0].data.membershipId).toBe('m2')
    expect(db.entryChangeLog.create).toHaveBeenCalledTimes(1)
    // Záznam, smazání volna i log jsou v jedné transakci; vytažení logu ven by tenhle test shodilo.
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(txVolani).toEqual(['entry.findMany', 'entry.deleteMany', 'entry.create', 'entryChangeLog.create'])
    expect(db.entryChangeLog.create.mock.calls[0][0].data).toEqual({
      membershipId: 'm2',
      dayKey: '2026-11-09',
      changedById: 'u1',
      before: Prisma.DbNull,
      after: { kind: 'WORK', hours: 8, fromTime: null, toTime: null, place: 'Zlín', note: null },
    })
  })

  it('saveEntryFor, který přebije „Nepracoval“, zaloguje i zmizelé volno', async () => {
    db.entry.findMany.mockResolvedValue([{ kind: 'DAYOFF', hours: null, fromTime: null, toTime: null, place: null, note: null }])
    await saveEntryFor('m2', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))
    const logy = db.entryChangeLog.create.mock.calls.map((c) => c[0].data)
    expect(logy).toHaveLength(2)
    expect(logy[0]).toMatchObject({ membershipId: 'm2', after: Prisma.DbNull, before: { kind: 'DAYOFF' } })
  })

  it('člen cizí firmy: chyba a žádný zápis', async () => {
    db.membership.findFirst.mockResolvedValue(null)
    expect(await saveEntryFor('cizi', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toHaveProperty('error')
    expect(await deleteEntryFor('cizi', 'e9')).toHaveProperty('error')
    expect(db.membership.findFirst).toHaveBeenCalledWith({ where: { id: 'cizi', orgId: 'o1' }, select: { id: true } })
    zadnyZapis()
  })

  it('bez oprávnění editOthersEntry akce skončí přesměrováním a nic nezapíše', async () => {
    requireCan.mockRejectedValue(redirect)
    await expect(saveEntryFor('m2', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).rejects.toBe(redirect)
    await expect(deleteEntryFor('m2', 'e9')).rejects.toBe(redirect)
    expect(db.membership.findFirst).not.toHaveBeenCalled()
    zadnyZapis()
  })

  it('uzavřené období platí i pro cizí zápis (zápis i smazání)', async () => {
    db.periodLock.findUnique.mockResolvedValue({ id: 'l1' })
    expect(await saveEntryFor('m2', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ error: ZAMEK })
    expect(await deleteEntryFor('m2', 'e9')).toEqual({ error: ZAMEK })
    zadnyZapis()
  })

  it('neplatný vstup a DAYOFF nic nezapíšou', async () => {
    expect(await saveEntryFor('m2', form({ day: '2026-11-09', kind: 'WORK' }))).toHaveProperty('error')
    expect(await saveEntryFor('m2', form({ day: '2026-11-09', kind: 'DAYOFF' }))).toHaveProperty('error')
    zadnyZapis()
  })

  it('deleteEntryFor maže jen v daném členství a loguje before:snímek / after:null s hodinami jako číslem', async () => {
    expect(await deleteEntryFor('m2', 'e9')).toEqual({ ok: true })
    expect(db.entry.findFirst.mock.calls[0][0].where).toEqual({ id: 'e9', membershipId: 'm2' })
    expect(db.entry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e9', membershipId: 'm2' } })
    expect(db.entryChangeLog.create.mock.calls[0][0].data).toEqual({
      membershipId: 'm2',
      dayKey: '2026-11-09',
      changedById: 'u1',
      before: { kind: 'WORK', hours: 7.5, fromTime: '08:00', toTime: '15:30', place: 'Zlín', note: null },
      after: Prisma.DbNull,
    })
  })

  it('deleteEntryFor: záznam jiného členství se nenajde, nic se nesmaže ani nezaloguje', async () => {
    db.entry.findFirst.mockResolvedValue(null)
    expect(await deleteEntryFor('m2', 'cizi')).toEqual({ error: 'Smazání se nepodařilo.' })
    zadnyZapis()
  })

  it('deleteEntryFor: count 0 je chyba a log nevznikne', async () => {
    db.entry.deleteMany.mockResolvedValue({ count: 0 })
    expect(await deleteEntryFor('m2', 'e9')).toEqual({ error: 'Smazání se nepodařilo.' })
    expect(db.entryChangeLog.create).not.toHaveBeenCalled()
  })

  it('vlastní zápis zaměstnance historii nezakládá', async () => {
    db.entry.findFirst.mockResolvedValue({ day: new Date(Date.UTC(2026, 10, 9)) })
    // Důkaz „zapsalo a nelogovalo“, ne jen „nelogovalo“: všechny tři akce opravdu uspěly.
    expect(await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ ok: true })
    expect(await deleteEntry('e1', 'o1')).toEqual({ ok: true })
    expect(await markDayOff('2026-11-09', 'o1')).toEqual({ ok: true })
    expect(db.entry.create).toHaveBeenCalled()
    expect(db.entryChangeLog.create).not.toHaveBeenCalled()
  })

  it('historii změn účetní nevidí, správce a super admin ano', () => {
    expect(can('ACCOUNTANT', 'viewChangeLog', false)).toBe(false)
    expect(can('EMPLOYEE', 'viewChangeLog', false)).toBe(false)
    expect(can('OWNER', 'viewChangeLog', false)).toBe(true)
    expect(can('EMPLOYEE', 'viewChangeLog', true)).toBe(true)
  })

  it('neaktivní členství téže firmy se opravit dá (odešlý člověk má poslední měsíc k srovnání)', async () => {
    // clenFirmy filtruje jen orgId, ne active; mock vrací člena a dotaz nesmí `active` obsahovat.
    expect(await saveEntryFor('m2', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ ok: true })
    expect(db.membership.findFirst.mock.calls[0][0].where).not.toHaveProperty('active')
  })

  it('super admin s aktivní firmou A míří na členství firmy B: odmítnuto', async () => {
    ctx.isSuperAdmin = true
    db.membership.findFirst.mockResolvedValue(null)
    try {
      expect(await saveEntryFor('m-firmy-b', form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toHaveProperty('error')
      expect(await deleteEntryFor('m-firmy-b', 'e9')).toHaveProperty('error')
      expect(db.membership.findFirst).toHaveBeenCalledWith({ where: { id: 'm-firmy-b', orgId: 'o1' }, select: { id: true } })
      zadnyZapis()
    } finally {
      ctx.isSuperAdmin = false
    }
  })

  it('membershipId, který není neprázdný řetězec: odmítnuto bez dotazu do databáze', async () => {
    for (const zle of ['', undefined, null, 42, { id: 'm2' }] as unknown as string[]) {
      expect(await saveEntryFor(zle, form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toHaveProperty('error')
      expect(await deleteEntryFor(zle, 'e9')).toHaveProperty('error')
    }
    expect(db.membership.findFirst).not.toHaveBeenCalled()
    zadnyZapis()
  })

  it('deleteEntryFor: id, které není neprázdný řetězec, je odmítnuto', async () => {
    for (const zle of ['', undefined, null, 7, ['e9']] as unknown as string[]) {
      expect(await deleteEntryFor('m2', zle)).toEqual({ error: 'Smazání se nepodařilo.' })
    }
    expect(db.entry.findFirst).not.toHaveBeenCalled()
    zadnyZapis()
  })

  it('deleteEntryFor čte jen pole snímku a den', async () => {
    await deleteEntryFor('m2', 'e9')
    expect(db.entry.findFirst.mock.calls[0][0].select).toEqual({ day: true, kind: true, hours: true, fromTime: true, toTime: true, place: true, note: true })
  })
})

// Okno, které zůstalo na předchozí firmě. Firma se bere z cookie, tak zápis z takového okna mířil do té
// přepnuté — a „Nepracoval“ jí mazal záznamy dne, které to okno nikdy nevidělo, takže se ani nezeptal.
// Stránka proto posílá firmu, pro kterou se vykreslila, a akce ji porovná dřív, než cokoli udělá.
describe('zápis z okna, které zůstalo na předchozí firmě', () => {
  const HLASKA = 'Mezitím jsi v jiném okně přepnul firmu. Obnov stránku a zkus to znovu.'
  const zadnyZapis = () => {
    expect(db.entry.create).not.toHaveBeenCalled()
    expect(db.entry.deleteMany).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    // Kontrola je před uzávěrkou: na zámek cizí firmy se akce ani nezeptá.
    expect(db.periodLock.findUnique).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ctx.org.periodStartDay = 1
    db.entry.deleteMany.mockResolvedValue({ count: 1 })
    db.entry.create.mockResolvedValue({})
    db.entry.findFirst.mockResolvedValue({ day: new Date(Date.UTC(2026, 10, 9)) })
    db.periodLock.findUnique.mockResolvedValue(null)
  })

  it('saveEntry: jiná firma ve skrytém poli, chyba a žádný zápis', async () => {
    expect(await saveEntry(form({ orgId: 'o2', day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('saveEntry: formulář firmu neposlal vůbec, taky chyba (fail-closed)', async () => {
    const fd = form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' })
    fd.delete('orgId')
    expect(await saveEntry(fd)).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('markDayOff: jiná firma, chyba a nic se nemaže', async () => {
    expect(await markDayOff('2026-11-09', 'o2')).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('deleteEntry: jiná firma, chyba která říká co se stalo (ne obecné „Smazání se nepodařilo“)', async () => {
    expect(await deleteEntry('e1', 'o2')).toEqual({ error: HLASKA })
    expect(db.entry.findFirst).not.toHaveBeenCalled()
    zadnyZapis()
  })

  it('i při uzavřeném období se ptá nejdřív na firmu, zámek cizí firmy se nečte', async () => {
    db.periodLock.findUnique.mockResolvedValue({ id: 'l1' })
    expect(await markDayOff('2026-11-09', 'o2')).toEqual({ error: HLASKA })
    expect(db.periodLock.findUnique).not.toHaveBeenCalled()
  })

  it('firma z kontextu projde: všechny tři akce zapíšou (důkaz, že kontrola nezakazuje všechno)', async () => {
    expect(await markDayOff('2026-11-09', 'o1')).toEqual({ ok: true })
    expect(await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ ok: true })
    expect(await deleteEntry('e1', 'o1')).toEqual({ ok: true })
  })
})

describe("soubor s 'use server'", () => {
  it('exportuje jen akce dne a opravy cizího zápisu (každý export je veřejně volatelný endpoint)', () => {
    // `jeDenUzavreny`, `clenFirmy` ani `snimek` mezi exporty být nesmí: jednou už se to muselo opravovat.
    expect(Object.keys(entryModule).sort()).toEqual(['deleteEntry', 'deleteEntryFor', 'markDayOff', 'saveEntry', 'saveEntryFor'])
  })
})
