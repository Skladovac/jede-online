import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({
  membership: { findMany: vi.fn() },
  entry: { findFirst: vi.fn() },
  reminderLog: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const push = vi.hoisted(() => ({ sendPush: vi.fn() }))
vi.mock('@/lib/push', () => push)

import { runReminder, shouldRemind } from '@/lib/reminder'

const settings = { remindEnabled: true, remindHour: 19, tracksFromKey: '2026-01-01' }
const base = { nowHour: 19, todayKey: '2026-11-08', settings, hasEntryToday: false, alreadyRemindedToday: false }

describe('shouldRemind', () => {
  it('pípne ve svou hodinu, když není zapsáno', () => {
    expect(shouldRemind(base)).toBe(true)
  })
  it('pípne i hodinu po termínu, ale ne po dvou', () => {
    expect(shouldRemind({ ...base, nowHour: 20 })).toBe(true)
    expect(shouldRemind({ ...base, nowHour: 21 })).toBe(true)
    expect(shouldRemind({ ...base, nowHour: 22 })).toBe(false)
    expect(shouldRemind({ ...base, nowHour: 2 })).toBe(false)
  })
  it('nepípne před svou hodinou', () => {
    expect(shouldRemind({ ...base, nowHour: 18 })).toBe(false)
  })
  it('nepípne, když už je zapsáno nebo odbyto', () => {
    expect(shouldRemind({ ...base, hasEntryToday: true })).toBe(false)
  })
  it('nepípne dvakrát za den', () => {
    expect(shouldRemind({ ...base, alreadyRemindedToday: true })).toBe(false)
  })
  it('nepípne vypnutým', () => {
    expect(shouldRemind({ ...base, settings: { ...settings, remindEnabled: false } })).toBe(false)
  })
  it('nepípne před datem, od kdy si zapisuje, ale v ten den už ano', () => {
    expect(shouldRemind({ ...base, settings: { ...settings, tracksFromKey: '2026-12-01' } })).toBe(false)
    expect(shouldRemind({ ...base, settings: { ...settings, tracksFromKey: '2026-11-08' } })).toBe(true)
  })
  it('pípne i v sobotu a na Vánoce', () => {
    expect(shouldRemind({ ...base, todayKey: '2026-11-07' })).toBe(true) // sobota
    expect(shouldRemind({ ...base, todayKey: '2026-12-24' })).toBe(true)
  })
  it('hodina 23 má okno jen do konce dne, ne do rána', () => {
    expect(shouldRemind({ ...base, nowHour: 23, settings: { ...settings, remindHour: 23 } })).toBe(true)
    expect(shouldRemind({ ...base, nowHour: 0, settings: { ...settings, remindHour: 23 } })).toBe(false)
  })
})

describe('runReminder', () => {
  // 18:30 UTC v listopadu = 19:30 v Praze (CET); kdyby se četlo UTC, byla by to hodina 18 a nepípalo by se.
  const at1930 = new Date('2026-11-08T18:30:00Z')
  const dbMembership = {
    id: 'm1',
    tracksFrom: new Date(Date.UTC(2026, 0, 1)),
    user: { id: 'u1', remindEnabled: true },
    org: { remindHour: 19, name: 'Alfa' },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    db.membership.findMany.mockResolvedValue([dbMembership])
    db.entry.findFirst.mockResolvedValue(null)
    db.reminderLog.findUnique.mockResolvedValue(null)
    db.reminderLog.create.mockResolvedValue({})
    db.reminderLog.delete.mockResolvedValue({})
    push.sendPush.mockResolvedValue({ sent: 1 })
  })

  it('pošle push na /den/<dnes> a zapíše log pražského dne', async () => {
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 1, sent: 1 })
    expect(push.sendPush).toHaveBeenCalledWith('u1', expect.objectContaining({ title: 'Zapiš si dnešní hodiny', url: '/den/2026-11-08' }))
    expect(db.reminderLog.create).toHaveBeenCalledWith({ data: { userId: 'u1', day: new Date(Date.UTC(2026, 10, 8)) } })
  })

  it('počítá pražskou hodinu a den: po půlnoci Praha nepípá a den je už následující', async () => {
    const now = new Date('2026-11-08T23:30:00Z') // 00:30 dne 9. 11. v Praze
    expect(await runReminder({ now })).toEqual({ checked: 1, sent: 0 })
    expect(db.reminderLog.create).not.toHaveBeenCalled()
    expect(db.entry.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 9)) } }))
  })

  it('zapíše log dřív, než pošle push', async () => {
    await runReminder({ now: at1930 })
    expect(db.reminderLog.create.mock.invocationCallOrder[0]).toBeLessThan(push.sendPush.mock.invocationCallOrder[0])
  })

  it('při kolizi unique (P2002) nepošle nic', async () => {
    db.reminderLog.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 1, sent: 0 })
    expect(push.sendPush).not.toHaveBeenCalled()
  })

  it('jinou chybu databáze nespolkne a nic nepošle', async () => {
    db.reminderLog.create.mockRejectedValue(Object.assign(new Error('down'), { code: 'P1001' }))
    await expect(runReminder({ now: at1930 })).rejects.toThrow('down')
    expect(push.sendPush).not.toHaveBeenCalled()
  })

  it('jakýkoli záznam dne (i "Nepracoval") znamená odbyto', async () => {
    db.entry.findFirst.mockResolvedValue({ id: 'e1' })
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 1, sent: 0 })
    // dotaz nefiltruje podle druhu záznamu
    expect(db.entry.findFirst).toHaveBeenCalledWith({ where: { membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 8)) }, select: { id: true } })
    expect(push.sendPush).not.toHaveBeenCalled()
  })

  it('už připomenutému dnes nepípne znovu', async () => {
    db.reminderLog.findUnique.mockResolvedValue({ id: 'l1' })
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 1, sent: 0 })
    expect(push.sendPush).not.toHaveBeenCalled()
  })

  it('hledá jen aktivní členství lidí s odběrem', async () => {
    await runReminder({ now: at1930 })
    expect(db.membership.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true, user: { pushSubscriptions: { some: {} } } } }))
  })

  it('když push nikam nedorazí, uvolní den pro další hodinový běh a nepočítá ho', async () => {
    push.sendPush.mockResolvedValue({ sent: 0 })
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 1, sent: 0 })
    expect(db.reminderLog.delete).toHaveBeenCalled()
  })

  it('force pípne mimo okno a nezapíše log; vypnutým a odbytým pořád nepípne', async () => {
    const night = new Date('2026-11-08T10:00:00Z')
    expect((await runReminder({ now: night })).sent).toBe(0)
    expect((await runReminder({ now: night, force: true })).sent).toBe(1)
    expect(db.reminderLog.create).not.toHaveBeenCalled()
    db.entry.findFirst.mockResolvedValue({ id: 'e1' })
    expect((await runReminder({ now: night, force: true })).sent).toBe(0)
    db.entry.findFirst.mockResolvedValue(null)
    db.membership.findMany.mockResolvedValue([{ ...dbMembership, user: { id: 'u1', remindEnabled: false } }])
    expect((await runReminder({ now: night, force: true })).sent).toBe(0)
  })

  it('force ignoruje dnešní log a nic nemaže, ani když nic nedorazí', async () => {
    db.reminderLog.findUnique.mockResolvedValue({ id: 'l1' })
    expect((await runReminder({ now: at1930, force: true })).sent).toBe(1)
    push.sendPush.mockResolvedValue({ sent: 0 })
    expect((await runReminder({ now: at1930, force: true })).sent).toBe(0)
    expect(db.reminderLog.delete).not.toHaveBeenCalled()
  })

  it('kolize P2002 u jednoho uživatele nepřeruší běh pro další', async () => {
    db.membership.findMany.mockResolvedValue([dbMembership, { ...dbMembership, id: 'm2', user: { id: 'u2', remindEnabled: true } }])
    db.reminderLog.create
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockResolvedValueOnce({})
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 2, sent: 1 })
    expect(push.sendPush).toHaveBeenCalledTimes(1)
    expect(push.sendPush).toHaveBeenCalledWith('u2', expect.anything())
  })

  it('log nemaže, když push dorazil; když ne, maže právě ten den toho uživatele', async () => {
    await runReminder({ now: at1930 })
    expect(db.reminderLog.delete).not.toHaveBeenCalled()
    push.sendPush.mockResolvedValue({ sent: 0 })
    await runReminder({ now: at1930 })
    expect(db.reminderLog.delete).toHaveBeenCalledWith({ where: { userId_day: { userId: 'u1', day: new Date(Date.UTC(2026, 10, 8)) } } })
  })

  it('hodinu bere z firmy členství: firma s hodinou 20 v 19:30 nepípne', async () => {
    db.membership.findMany.mockResolvedValue([{ ...dbMembership, org: { ...dbMembership.org, remindHour: 21 } }])
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 1, sent: 0 })
    expect(push.sendPush).not.toHaveBeenCalled()
  })

  it('člověk ve dvou firmách dostane za den jednu připomínku, vyhrává první členství na řadě', async () => {
    const druha = { ...dbMembership, id: 'm2', org: { remindHour: 19, name: 'Beta' } } // stejný user u1
    db.membership.findMany.mockResolvedValue([dbMembership, druha])
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 2, sent: 1 })
    expect(push.sendPush).toHaveBeenCalledTimes(1)
    expect(db.reminderLog.create).toHaveBeenCalledTimes(1)
  })

  it('i při force pošle člověku ve dvou firmách jen jednu zkoušku', async () => {
    db.membership.findMany.mockResolvedValue([dbMembership, { ...dbMembership, id: 'm2' }])
    expect((await runReminder({ now: at1930, force: true })).sent).toBe(1)
  })

  it('odbyté členství nebrání připomínce za druhou firmu, kde ještě nic zapsáno není', async () => {
    db.membership.findMany.mockResolvedValue([dbMembership, { ...dbMembership, id: 'm2' }])
    db.entry.findFirst.mockImplementation(async ({ where }: { where: { membershipId: string } }) => (where.membershipId === 'm1' ? { id: 'e1' } : null))
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 2, sent: 1 })
  })

  it('každé členství čte hodinu ze SVÉ firmy: firmy s hodinou 19 a 22 v 19:30 pípne jen první', async () => {
    const dalsi = { ...dbMembership, id: 'm2', user: { id: 'u2', remindEnabled: true }, org: { remindHour: 22, name: 'Beta' } }
    db.membership.findMany.mockResolvedValue([dbMembership, dalsi])
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 2, sent: 1 })
    expect(push.sendPush).toHaveBeenCalledTimes(1)
    expect(push.sendPush).toHaveBeenCalledWith('u1', expect.anything())
  })

  it('každé členství čte tracksFrom ze sebe: druhému začíná až v prosinci, tak nepípne', async () => {
    const dalsi = { ...dbMembership, id: 'm2', user: { id: 'u2', remindEnabled: true }, tracksFrom: new Date(Date.UTC(2026, 11, 1)) }
    db.membership.findMany.mockResolvedValue([dbMembership, dalsi])
    expect(await runReminder({ now: at1930 })).toEqual({ checked: 2, sent: 1 })
    expect(push.sendPush).toHaveBeenCalledWith('u1', expect.anything())
  })

  it('tělo připomínky nese název firmy', async () => {
    await runReminder({ now: at1930 })
    expect(push.sendPush).toHaveBeenCalledWith('u1', expect.objectContaining({ body: expect.stringContaining('Alfa') }))
  })

  it('v letním čase (CEST, UTC+2) čte hodinu i den pražsky', async () => {
    // 17:30 UTC = 19:30 CEST -> pípá; kdyby se četlo UTC nebo +1, byla by to hodina 17 / 18
    expect(await runReminder({ now: new Date('2027-07-10T17:30:00Z') })).toEqual({ checked: 1, sent: 1 })
    expect(db.reminderLog.create).toHaveBeenCalledWith({ data: { userId: 'u1', day: new Date(Date.UTC(2027, 6, 10)) } })
    vi.clearAllMocks()
    db.membership.findMany.mockResolvedValue([dbMembership])
    db.entry.findFirst.mockResolvedValue(null)
    db.reminderLog.findUnique.mockResolvedValue(null)
    // 22:30 UTC = 00:30 CEST dalšího dne -> nepípá, den je 11. 7.
    expect(await runReminder({ now: new Date('2027-07-10T22:30:00Z') })).toEqual({ checked: 1, sent: 0 })
    expect(db.entry.findFirst).toHaveBeenCalledWith({ where: { membershipId: 'm1', day: new Date(Date.UTC(2027, 6, 11)) }, select: { id: true } })
  })
})
