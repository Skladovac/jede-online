import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifySource } from './traffic'

const own = 'vasirm.jede.online'

test('vyhledávače a portály', () => {
  assert.equal(classifySource('https://www.google.com/', '', own), 'Google')
  assert.equal(classifySource('https://www.google.cz/search?q=reality', '', own), 'Google')
  assert.equal(classifySource('https://search.seznam.cz/?q=makler+zlin', '', own), 'Seznam')
  assert.equal(classifySource('https://www.sreality.cz/detail/prodej/dum/123', '', own), 'Sreality')
  assert.equal(classifySource('https://l.facebook.com/l.php?u=x', '', own), 'Facebook')
})

test('vlastní web není nová návštěva', () => {
  assert.equal(classifySource('https://vasirm.jede.online/nabidka', '', own), null)
  assert.equal(classifySource('https://www.vasirm.cz/o-nas', '', own), null)
})

test('přímo, kampaň a neznámý web', () => {
  assert.equal(classifySource('', '', own), 'Přímo / neznámý')
  assert.equal(classifySource('nesmysl', '', own), 'Přímo / neznámý')
  assert.equal(classifySource('', 'Letak_Zlin', own), 'Kampaň: letak_zlin')
  assert.equal(classifySource('https://www.google.com/', 'facebook', own), 'Facebook')
  assert.equal(classifySource('https://www.firmy.cz/detail/123', '', own), 'firmy.cz')
})
