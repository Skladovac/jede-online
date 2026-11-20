import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, formatArea, slugify, nbsp, paragraphs, monthlyPayment } from './format'

const N = ' '

test('cena s nezlomitelnými mezerami', () => {
  assert.equal(formatPrice(6480000), `6${N}480${N}000${N}Kč`)
  assert.equal(formatPrice(null), 'Cena na vyžádání')
  assert.equal(formatPrice(18000, true), `18${N}000${N}Kč${N}/${N}měsíc`)
})

test('plocha', () => {
  assert.equal(formatArea(1366), `1${N}366${N}m²`)
  assert.equal(formatArea(null), '')
})

test('slug bez diakritiky', () => {
  assert.equal(slugify('Rodinný dům 6+1, 150 m², Kvasice'), 'rodinny-dum-6-1-150-m2-kvasice')
  assert.equal(slugify('  Zlín – Chlum  '), 'zlin-chlum')
})

test('jednopísmenné předložky', () => {
  assert.equal(nbsp('dům v Lukově a s garáží'), `dům v${N}Lukově a${N}s${N}garáží`)
})

test('odstavce', () => {
  assert.deepEqual(paragraphs('A\n\n  B  \n\n\n'), ['A', 'B'])
})

test('splátka hypotéky', () => {
  // 5 000 000 Kč, 4,5 %, 30 let ≈ 25 334 Kč
  assert.equal(Math.round(monthlyPayment(5_000_000, 4.5, 30)), 25334)
  assert.equal(monthlyPayment(1200, 0, 1), 100)
  assert.equal(monthlyPayment(0, 4, 30), 0)
})
