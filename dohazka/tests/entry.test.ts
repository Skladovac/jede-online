import { describe, expect, it } from 'vitest'
import { hoursFromRange, parseHours, parseTime, validateEntry } from '@/lib/entry'

describe('parseHours', () => {
  it('bere čárku i tečku', () => {
    expect(parseHours('8,5')).toBe(8.5)
    expect(parseHours('8.5')).toBe(8.5)
    expect(parseHours('8')).toBe(8)
    expect(parseHours(' 8,5 ')).toBe(8.5)
  })
  it('odmítne nesmysly a hodnoty mimo rozsah', () => {
    for (const bad of ['', 'osm', '8,5,5', '-3', '25', '24,5', 'NaN', '1e3']) {
      expect(parseHours(bad), bad).toBeNull()
    }
  })
  it('nula je platná', () => {
    expect(parseHours('0')).toBe(0)
  })
})

describe('parseTime', () => {
  it('normalizuje na HH:MM', () => {
    expect(parseTime('7:00')).toBe('07:00')
    expect(parseTime('07:00')).toBe('07:00')
    expect(parseTime('7.00')).toBe('07:00')
    expect(parseTime('7,30')).toBe('07:30')
    expect(parseTime('23:59')).toBe('23:59')
  })
  it('odmítne neplatný čas', () => {
    for (const bad of ['', '24:00', '7:60', '-1:00', 'ráno', '7:0']) expect(parseTime(bad), bad).toBeNull()
  })
})

describe('hoursFromRange', () => {
  it('spočítá běžnou směnu', () => {
    expect(hoursFromRange('07:00', '15:30')).toBe(8.5)
  })
  it('noční směna přes půlnoc není negativní', () => {
    expect(hoursFromRange('22:00', '06:00')).toBe(8)
  })
  it('stejný čas je nula', () => {
    expect(hoursFromRange('07:00', '07:00')).toBe(0)
  })
  it('půlnoční hranice nezlobí', () => {
    expect(hoursFromRange('23:30', '00:30')).toBe(1)
    expect(hoursFromRange('00:00', '00:00')).toBe(0)
  })
})

describe('validateEntry', () => {
  const base = { day: '2026-11-08', kind: 'WORK', fromTime: null, toTime: null, note: null }
  it('práce potřebuje hodiny i místo', () => {
    expect(validateEntry({ ...base, hours: '8', place: 'Zlín' }).ok).toBe(true)
    expect(validateEntry({ ...base, hours: '8', place: '  ' }).ok).toBe(false)
    expect(validateEntry({ ...base, hours: '', place: 'Zlín' }).ok).toBe(false)
  })
  it('volno nepotřebuje ani hodiny, ani místo', () => {
    const r = validateEntry({ ...base, kind: 'DAYOFF', hours: '', place: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.hours).toBeNull()
  })
  it('místo se trimuje a dlouhé se odmítne', () => {
    const r = validateEntry({ ...base, hours: '8', place: '  Zlín  ' })
    expect(r.ok && r.value.place).toBe('Zlín')
    expect(validateEntry({ ...base, hours: '8', place: 'x'.repeat(201) }).ok).toBe(false)
  })
  it('neznámý typ dne neprojde', () => {
    expect(validateEntry({ ...base, kind: 'DOVOLENA', hours: '8', place: 'Zlín' }).ok).toBe(false)
  })
  it('poznámka se trimuje a prázdná je null', () => {
    const r = validateEntry({ ...base, hours: '8', place: 'Zlín', note: '  ahoj  ' })
    expect(r.ok && r.value.note).toBe('ahoj')
    const prazdna = validateEntry({ ...base, hours: '8', place: 'Zlín', note: '   ' })
    expect(prazdna.ok && prazdna.value.note).toBeNull()
  })
  it('neexistující datum neprojde', () => {
    expect(validateEntry({ ...base, day: '2026-02-31', hours: '8', place: 'Zlín' }).ok).toBe(false)
    expect(validateEntry({ ...base, day: '2026-13-45', hours: '8', place: 'Zlín' }).ok).toBe(false)
    expect(validateEntry({ ...base, day: '0000-00-00', hours: '8', place: 'Zlín' }).ok).toBe(false)
  })
})
