import { describe, expect, it } from 'vitest'
import { recentPlaces } from '@/lib/places'

describe('recentPlaces', () => {
  const entries = [
    { place: 'Zlín', day: '2026-11-07' },
    { place: 'Otrokovice', day: '2026-11-06' },
    { place: 'Zlín', day: '2026-11-05' },
    { place: null, day: '2026-11-04' },
    { place: '  Vsetín  ', day: '2026-11-03' },
  ]
  it('bez duplicit, nejčerstvější první', () => {
    expect(recentPlaces(entries)).toEqual(['Zlín', 'Otrokovice', 'Vsetín'])
  })
  it('respektuje limit a přeskočí prázdná místa', () => {
    expect(recentPlaces(entries, 2)).toEqual(['Zlín', 'Otrokovice'])
    expect(recentPlaces([{ place: null, day: '2026-11-01' }])).toEqual([])
  })
  it('řadí podle dne, i když vstup není seřazený', () => {
    const nahodne = [
      { place: 'Vsetín', day: '2026-11-01' },
      { place: 'Zlín', day: '2026-11-07' },
      { place: 'Otrokovice', day: '2026-11-04' },
    ]
    expect(recentPlaces(nahodne)).toEqual(['Zlín', 'Otrokovice', 'Vsetín'])
  })
  it('duplicitu pozná i přes mezery, zachová první (nejčerstvější) zápis', () => {
    expect(
      recentPlaces([
        { place: 'Zlín ', day: '2026-11-07' },
        { place: ' Zlín', day: '2026-11-06' },
        { place: '   ', day: '2026-11-05' },
      ]),
    ).toEqual(['Zlín'])
  })
})
