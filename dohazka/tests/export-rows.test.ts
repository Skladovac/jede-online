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
  const r = buildReport({ orgName: 'Stavby Novák s.r.o.', personName: 'Jan Novák', fromKey: '2026-11-01', toKey: '2026-11-08', month })

  it('vynechá dny bez záznamu a řadí chronologicky', () => {
    expect(r.rows.map((x) => x.dayKey)).toEqual(['2026-11-02', '2026-11-04', '2026-11-06'])
  })
  it('názvy dnů jsou správné (UTC, pátek není čtvrtek)', () => {
    expect(r.rows.map((x) => x.weekday)).toEqual(['pondělí', 'středa', 'pátek'])
  })
  it('kind je prázdný u práce, jinak česky; null hodiny jsou prázdný text', () => {
    expect(r.rows[0].kind).toBe('')
    expect(r.rows[1]).toMatchObject({ kind: 'Dovolená', hours: '', hoursValue: null, fromTime: '', place: '', note: '' })
  })
  it('součet a popisky', () => {
    expect(r.rows[0].hoursValue).toBe(8.5)
    expect(r.totalHoursValue).toBe(17)
    expect(r).toMatchObject({ totalHours: '17', daysWorked: 2, periodLabel: 'listopad 2026', personName: 'Jan Novák', orgName: 'Stavby Novák s.r.o.' })
  })
  it('nekalendářní období má v popisku rozsah', () => {
    const x = buildReport({ orgName: 'F', personName: 'A', fromKey: '2026-10-16', toKey: '2026-11-15', month })
    expect(x.periodLabel).toBe('listopad 2026 (16. 10. 2026 – 15. 11. 2026)')
  })
})

describe('contentDisposition', () => {
  it('ošetří mezeru a diakritiku', () => {
    const h = contentDisposition('Jan Novák', '2026-11', 'csv', 'Stavby Novák')
    expect(h).toBe(`attachment; filename="dohazka-Stavby-Novak-Jan-Novak-2026-11.csv"; filename*=UTF-8''dohazka-Stavby-Nov%C3%A1k-Jan-Nov%C3%A1k-2026-11.csv`)
  })
  it('stejný měsíc ve dvou firmách dá dva různé názvy souborů', () => {
    expect(contentDisposition('Jan', '2026-11', 'pdf', 'Alfa')).not.toBe(contentDisposition('Jan', '2026-11', 'pdf', 'Beta'))
  })
  it('název firmy s uvozovkou a lomítkem hlavičku nerozbije', () => {
    const h = contentDisposition('Jan Novák', '2026-11', 'pdf', 'A"B/C')
    expect(h).toBe(`attachment; filename="dohazka-A-B-C-Jan-Novak-2026-11.pdf"; filename*=UTF-8''dohazka-A-B-C-Jan-Nov%C3%A1k-2026-11.pdf`)
  })
  it('prázdné jméno nerozbije hlavičku', () => {
    expect(contentDisposition('???', '2026-11', 'xlsx', '???')).toContain('filename="dohazka-vykaz-2026-11.xlsx"')
  })
})
