import { describe, expect, it } from 'vitest'
import { buildReport } from '@/lib/export/rows'
import { contentDisposition } from '@/lib/export/filename'
import { buildMonth } from '@/lib/month'

const z = (dayKey: string, over: Partial<Parameters<typeof buildMonth>[0]['entries'][number]> = {}) => ({
  id: dayKey, dayKey, kind: 'WORK' as const, hours: 8.5, fromTime: '07:00', toTime: '15:30', place: 'Zlín', note: null, ...over,
})

describe('buildReport', () => {
  const month = buildMonth({
    fromKey: '2026-11-01',
    toKey: '2026-11-08',
    tracksFromKey: '2026-11-03',
    entries: [z('2026-11-06'), z('2026-11-02'), z('2026-11-04', { kind: 'VACATION', hours: null, fromTime: null, toTime: null, place: null })],
  })
  const r = buildReport({ personName: 'Jan Novák', fromKey: '2026-11-01', toKey: '2026-11-08', month })

  it('vynechá dny bez záznamu a řadí chronologicky', () => {
    expect(r.rows.map((x) => x.dayKey)).toEqual(['2026-11-02', '2026-11-04', '2026-11-06'])
  })
  it('názvy dnů jsou správné (UTC, pátek není čtvrtek)', () => {
    expect(r.rows.map((x) => x.weekday)).toEqual(['pondělí', 'středa', 'pátek'])
  })
  it('kind je prázdný u práce, jinak česky; null hodiny jsou prázdný text', () => {
    expect(r.rows[0].kind).toBe('')
    expect(r.rows[1]).toMatchObject({ kind: 'Dovolená', hours: '', fromTime: '', place: '', note: '' })
  })
  it('součet a popisky', () => {
    expect(r).toMatchObject({ totalHours: '17', daysWorked: 2, periodLabel: 'listopad 2026', personName: 'Jan Novák' })
  })
  it('nekalendářní období má v popisku rozsah', () => {
    const x = buildReport({ personName: 'A', fromKey: '2026-10-16', toKey: '2026-11-15', month })
    expect(x.periodLabel).toBe('listopad 2026 (16. 10. 2026 – 15. 11. 2026)')
  })
})

describe('contentDisposition', () => {
  it('ošetří mezeru a diakritiku', () => {
    const h = contentDisposition('Jan Novák', '2026-11', 'csv')
    expect(h).toBe(`attachment; filename="dohazka-Jan-Novak-2026-11.csv"; filename*=UTF-8''dohazka-Jan-Nov%C3%A1k-2026-11.csv`)
  })
  it('prázdné jméno nerozbije hlavičku', () => {
    expect(contentDisposition('???', '2026-11', 'xlsx')).toContain('filename="dohazka-vykaz-2026-11.xlsx"')
  })
})
