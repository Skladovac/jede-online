import { describe, expect, it } from 'vitest'
import { pickMembership } from '@/lib/membership'

const a = { id: 'm1', orgId: 'o1', active: true }
const b = { id: 'm2', orgId: 'o2', active: true }
const zrusene = { id: 'm3', orgId: 'o3', active: false }

describe('pickMembership', () => {
  it('vybere chtěnou firmu', () => expect(pickMembership([a, b], 'o2')).toBe(b))
  it('bez volby vezme první aktivní', () => expect(pickMembership([a, b], null)).toBe(a))
  it('cizí nebo neznámé id firmy spadne na první aktivní, ne na cizí data', () =>
    expect(pickMembership([a, b], 'o-cizi')).toBe(a))
  it('deaktivované členství nevybere nikdy', () => {
    expect(pickMembership([zrusene], 'o3')).toBe(null)
    expect(pickMembership([zrusene], null)).toBe(null)
  })
  it('bez členství vrací null', () => expect(pickMembership([], 'o1')).toBe(null))

  // Doplněno: původní zadání by prošlo i implementací, která vrací první prvek seznamu
  // bez kontroly `active`, protože v každém testu je první prvek aktivní nebo je jediný.
  it('chtěná firma je deaktivovaná: spadne na jinou aktivní, ne na zrušenou', () =>
    expect(pickMembership([zrusene, a], 'o3')).toBe(a))
  it('deaktivované členství na prvním místě se při výchozí volbě přeskočí', () =>
    expect(pickMembership([zrusene, b], null)).toBe(b))
  it('prázdné id firmy se chová jako žádná volba', () =>
    expect(pickMembership([a, b], '')).toBe(a))
})
