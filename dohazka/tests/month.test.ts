import { describe, expect, it } from 'vitest'
import { buildMonth, visibleRows } from '@/lib/month'

const e = (dayKey: string, hours: number | null, place: string | null, kind = 'WORK') =>
  ({ id: dayKey + kind + place, dayKey, kind, hours, fromTime: null, toTime: null, place, note: null }) as never

describe('buildMonth', () => {
  it('sečte hodiny a spočítá dny, dva záznamy v jednom dni se sloučí', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-03',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-02', 4, 'Zlín'), e('2026-11-02', 4, 'Vsetín'), e('2026-11-03', 8.5, 'Otrokovice')],
    })
    expect(r.totalHours).toBe(16.5)
    expect(r.daysWorked).toBe(2)
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0].dayKey).toBe('2026-11-03') // nejnovější první
    expect(r.rows.find((x) => x.dayKey === '2026-11-02')!.entries).toHaveLength(2)
  })
  it('den bez záznamu je prázdný, den před tracksFrom není', () => {
    const r = buildMonth({ fromKey: '2026-11-01', toKey: '2026-11-03', tracksFromKey: '2026-11-03', entries: [] })
    expect(r.rows.map((x) => x.state)).toEqual(['empty', 'before-start', 'before-start'])
  })
  it('volno se nepočítá jako odpracovaný den', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-02',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-01', null, null, 'DAYOFF'), e('2026-11-02', 8, 'Zlín')],
    })
    expect(r.daysWorked).toBe(1)
    expect(r.totalHours).toBe(8)
  })
  it('prázdné období nespadne', () => {
    const r = buildMonth({ fromKey: '2026-11-01', toKey: '2026-11-30', tracksFromKey: '2026-11-01', entries: [] })
    expect(r.totalHours).toBe(0)
    expect(r.daysWorked).toBe(0)
    expect(r.rows).toHaveLength(30)
  })
  it('součet neplave', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-03',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-01', 7.7, 'Zlín'), e('2026-11-02', 0.1, 'Zlín'), e('2026-11-03', 0.2, 'Zlín')],
    })
    expect(r.totalHours).toBe(8)
  })
  it('součet neplave ani naivně (0,1 + 0,2 + 0,3 = 0,6)', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-03',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-01', 0.1, 'Zlín'), e('2026-11-02', 0.2, 'Zlín'), e('2026-11-03', 0.3, 'Zlín')],
    })
    expect(r.totalHours).toBe(0.6)
  })
})

describe('visibleRows', () => {
  const m = buildMonth({
    fromKey: '2026-11-01',
    toKey: '2026-11-30',
    tracksFromKey: '2026-11-03',
    entries: [e('2026-11-08', 8, 'Zlín'), e('2026-11-20', null, null, 'VACATION')],
  })
  it('skryje prázdné dny po dnešku a dny před začátkem, vyplněné budoucí nechá', () => {
    const keys = visibleRows(m.rows, '2026-11-08').map((r) => r.dayKey)
    expect(keys[0]).toBe('2026-11-20') // dovolená napřed zapsaná zůstane
    expect(keys).toContain('2026-11-08')
    expect(keys).toContain('2026-11-03')
    expect(keys).not.toContain('2026-11-09')
    expect(keys).not.toContain('2026-11-02')
  })
})
