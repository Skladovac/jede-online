import { describe, expect, it, vi } from 'vitest'
import { buildMonth } from '@/lib/month'
import { buildCompanyReport } from '@/lib/company-report'

const e = (dayKey: string, hours: number | null, kind = 'WORK') =>
  ({ id: dayKey + hours + kind, dayKey, kind, hours, fromTime: null, toTime: null, place: null, note: null }) as never
const mesic = (tracksFromKey: string, entries: never[]) =>
  buildMonth({ fromKey: '2026-11-01', toKey: '2026-11-30', tracksFromKey, entries })
const base = { orgName: 'Stavby Novák s.r.o.', fromKey: '2026-11-01', toKey: '2026-11-30', todayKey: '2026-11-10' }

describe('buildCompanyReport', () => {
  it('součet firmy je součtem lidí a počítá se v setinách', () => {
    const r = buildCompanyReport({
      ...base,
      people: [
        { personName: 'A', month: mesic('2026-11-01', [e('2026-11-02', 7.7), e('2026-11-03', 0.1), e('2026-11-04', 0.2)]) },
        { personName: 'B', month: mesic('2026-11-01', [e('2026-11-02', 8)]) },
      ],
    })
    expect(r.rows[0].totalHoursValue).toBe(8) // 7,7+0,1+0,2 nesmí vyjít 7.999…
    expect(r.totalHoursValue).toBe(16)
    expect(r.totalHours).toBe('16')
  })
  it('součet lidí na firemní úrovni se taky počítá v setinách', () => {
    // 0,1 + 0,2 = 0.30000000000000004 při naivním sčítání lidí
    const r = buildCompanyReport({
      ...base,
      people: [
        { personName: 'A', month: mesic('2026-11-01', [e('2026-11-02', 0.1)]) },
        { personName: 'B', month: mesic('2026-11-01', [e('2026-11-02', 0.2)]) },
      ],
    })
    expect(r.totalHoursValue).toBe(0.3)
    expect(r.totalHours).toBe('0,3')
  })
  it('chybějící dny jsou dny bez záznamu od tracksFrom do dneška, ne budoucí', () => {
    const r = buildCompanyReport({
      ...base,
      people: [{ personName: 'A', month: mesic('2026-11-05', [e('2026-11-06', 8), e('2026-11-20', 8, 'VACATION')]) }],
    })
    // 5. a 7.–9.; dnešek (10.) ještě neskončil; 1.–4. je před začátkem zapisování, 11.–30. budoucnost, 20. má záznam
    expect(r.rows[0].missingDays).toEqual(['2026-11-05', '2026-11-07', '2026-11-08', '2026-11-09'])
  })
  it('člověk, kterému se mezery nehledají (neaktivní), je má prázdné, hodiny mu zůstanou', () => {
    const r = buildCompanyReport({
      ...base,
      people: [{ personName: 'A', trackGaps: false, month: mesic('2026-11-01', [e('2026-11-02', 8)]) }],
    })
    expect(r.rows[0].missingDays).toEqual([])
    expect(r.rows[0].totalHoursValue).toBe(8)
  })
  it('zachová pořadí lidí a vyplní popisek období a firmu', () => {
    const r = buildCompanyReport({
      ...base,
      people: [
        { personName: 'Žák', month: mesic('2026-11-01', []) },
        { personName: 'Adam', month: mesic('2026-11-01', []) },
      ],
    })
    expect(r.rows.map((x) => x.personName)).toEqual(['Žák', 'Adam'])
    expect(r.orgName).toBe('Stavby Novák s.r.o.')
    expect(r.periodLabel).toBe('listopad 2026')
  })
  it('bez todayKey se bere dnešek z hodin v pražském čase', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
    try {
      const { todayKey: _t, ...bez } = base
      const r = buildCompanyReport({ ...bez, people: [{ personName: 'A', month: mesic('2026-11-01', []) }] })
      expect(r.rows[0].missingDays).toEqual(['2026-11-01', '2026-11-02'])
    } finally {
      vi.useRealTimers()
    }
  })
})
