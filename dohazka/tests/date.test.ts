import { describe, expect, it } from 'vitest'
import { dayKeysInRange, formatHours, parseDayKey, periodRange, pragueDayKey, pragueHour } from '@/lib/date'

describe('pražský čas', () => {
  it('den se láme podle Prahy, ne podle UTC', () => {
    expect(pragueDayKey(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09')
    expect(pragueDayKey(new Date('2026-07-08T22:30:00Z'))).toBe('2026-07-09') // letní čas
  })
  it('hodina je pražská', () => {
    expect(pragueHour(new Date('2026-11-08T18:00:00Z'))).toBe(19)
    expect(pragueHour(new Date('2026-07-08T17:00:00Z'))).toBe(19)
  })
})

describe('periodRange', () => {
  it('startDay 1 je kalendářní měsíc', () => {
    expect(periodRange(1, 2026, 11)).toEqual({ fromKey: '2026-11-01', toKey: '2026-11-30' })
  })
  it('startDay 16 jde přes přelom měsíce', () => {
    expect(periodRange(16, 2026, 11)).toEqual({ fromKey: '2026-10-16', toKey: '2026-11-15' })
  })
  it('startDay 31 v únoru nespadne na neexistující den', () => {
    expect(periodRange(31, 2026, 3)).toEqual({ fromKey: '2026-02-28', toKey: '2026-03-30' })
  })
  it('období dlaždicují kalendář: žádný den dvakrát, žádný nevynechaný', () => {
    const den = 86_400_000
    for (const startDay of [1, 16, 28, 29, 30, 31]) {
      let predchozi: { fromKey: string; toKey: string } | null = null
      for (let i = 0; i < 48; i++) { // leden 2026 až prosinec 2029, vč. přestupného února 2028
        const rok = 2026 + Math.floor(i / 12)
        const r = periodRange(startDay, rok, (i % 12) + 1)
        expect(r.fromKey <= r.toKey, `${startDay} ${rok}-${i % 12 + 1}`).toBe(true)
        if (predchozi) {
          const dalsi = pragueDayKey(new Date(parseDayKey(predchozi.toKey).getTime() + den))
          expect(r.fromKey, `startDay ${startDay}, měsíc ${i + 1}`).toBe(dalsi)
        }
        predchozi = r
      }
    }
  })
})

describe('formatHours', () => {
  it('desetinná čárka, bez zbytečných nul', () => {
    expect(formatHours(8.5)).toBe('8,5')
    expect(formatHours(8)).toBe('8')
    expect(formatHours(0)).toBe('0')
    expect(formatHours(7.25)).toBe('7,25')
  })
})

describe('dayKeysInRange', () => {
  it('vrátí všechny dny včetně krajních', () => {
    expect(dayKeysInRange('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
  })
})

describe('parseDayKey', () => {
  it('dá UTC midnight, aby @db.Date neujížděl o zónu', () => {
    expect(parseDayKey('2026-11-08').toISOString()).toBe('2026-11-08T00:00:00.000Z')
    expect(parseDayKey('2026-07-08').toISOString()).toBe('2026-07-08T00:00:00.000Z') // letní čas nic nemění
  })
  it('kolečko tam a zpátky nemění den', () => {
    for (const key of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31']) {
      expect(pragueDayKey(parseDayKey(key)), key).toBe(key)
    }
  })
})
