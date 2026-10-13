import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapEstate, normalizeDescription } from './realman'

// Vzorová data podle „Dokumentace exportu na externí web klienta v3“ (Realman) + atributů Sreality.
const house = {
  estate: {
    id: 7,
    title: 'Prodej rodinného domu 323 m², Zlín – Chlum',
    advert_function: 1,
    advert_type: 2,
    advert_subtype: 37,
    advert_room_count: 5,
    advert_price: 6480000,
    advert_price_currency: 1,
    advert_price_unit: 1,
    advert_price_text_note: 'včetně provize',
    usable_area: 323,
    estate_area: 1366,
    energy_efficiency_rating: 7,
    extra_info: 1,
    locality_city: 'Zlín',
    locality_citypart: 'Chlum',
    description: 'První odstavec.\nDruhý odstavec.',
    building_condition: 2,
    garage: true,
    cellar: false,
    balcony: 1,
    balcony_area: 6,
    updated: '2026-10-13 10:00:00',
  },
  estate_readable: {
    advert_room_count: '5 a více pokojů',
    building_condition: 'Dobrý',
    heating: ['Ústřední tuhá paliva', 'Podlahové'],
    balcony_area: '6 m2',
    advert_price: '6 480 000 Kč',
  },
  seller: { id: 3, name: 'Ondřej', surname: 'Nedbálek', email: 'Nedbalek@vasirm.cz' },
  photos: [
    { url: 'https://img.realman.cz/b.jpg?t=1', hash: 'bbb', title: 'Zahrada', order: 2 },
    { url: 'https://img.realman.cz/a.jpg?t=1', hash: 'aaa', title: 'Dům', order: 1 },
    { url: 'http://nebezpecne.cz/c.jpg', hash: 'ccc', title: 'x', order: 3 },
  ],
  videos: [{ title: 'Prohlídka', updated: '2026-10-13', hash: 'dQw4w9WgXcQ' }],
}

test('dům: typ, cena, plochy, stav, lokalita', () => {
  const m = mapEstate(house)
  assert.equal(m.propertyType, 'HOUSE')
  assert.equal(m.offerType, 'SALE')
  assert.equal(m.status, 'RESERVED')
  assert.equal(m.price, 6480000)
  assert.equal(m.priceNote, 'včetně provize')
  assert.equal(m.usableArea, 323)
  assert.equal(m.landArea, 1366)
  assert.equal(m.disposition, '5 a více pokojů')
  assert.equal(m.energyClass, 'G')
  assert.equal(m.locality, 'Zlín – Chlum')
  assert.equal(m.mapQuery, 'Chlum, Zlín')
  assert.equal(m.sellerEmail, 'nedbalek@vasirm.cz')
  assert.equal(m.description, 'První odstavec.\n\nDruhý odstavec.')
})

test('parametry: čitelné hodnoty, multiselect, ano/ne s plochou', () => {
  const { params } = mapEstate(house)
  const get = (l: string) => params.find((p) => p.label === l)?.value
  assert.equal(get('Stav'), 'Dobrý')
  assert.equal(get('Topení'), 'Ústřední tuhá paliva, Podlahové')
  assert.equal(get('Balkon'), '6 m²')
  assert.equal(get('Garáž'), 'ano')
  assert.equal(get('Sklep'), undefined)
})

test('fotky podle pořadí, jen https; video z YouTube', () => {
  const m = mapEstate(house)
  assert.deepEqual(
    m.photos.map((p) => p.hash),
    ['aaa', 'bbb'],
  )
  assert.deepEqual(m.video, { kind: 'youtube', id: 'dQw4w9WgXcQ' })
})

test('byt k pronájmu, cena v EUR jde do poznámky, prodáno', () => {
  const m = mapEstate({
    estate: { advert_function: 2, advert_type: 1, advert_subtype: 7, advert_price: 900, advert_price_currency: 3, extra_info: 2, estate_area: 50 },
    estate_readable: { advert_price: '900 EUR za měsíc' },
    photos: {},
  })
  assert.equal(m.propertyType, 'FLAT')
  assert.equal(m.offerType, 'RENT')
  assert.equal(m.status, 'SOLD')
  assert.equal(m.disposition, '3+1')
  assert.equal(m.price, null)
  assert.equal(m.priceNote, '900 EUR za měsíc')
  assert.equal(m.landArea, null)
  assert.equal(m.photos.length, 0)
})

test('chata, cena „na vyžádání“ (0), video souborem, kolekce jako objekt', () => {
  const m = mapEstate({
    estate: { advert_type: 2, advert_subtype: 43, advert_price: 1, project: 1 },
    videos: { 0: { title: 'Video', updated: 'u1', url: 'https://files.realman.cz/v.mp4?sig=x' } },
    photos: { 0: { url: 'https://x/1.jpg', hash: 'h1', order: '1' } },
  })
  assert.equal(m.propertyType, 'COTTAGE')
  assert.equal(m.price, null)
  assert.equal(m.isProject, true)
  assert.deepEqual(m.video, { kind: 'file', url: 'https://files.realman.cz/v.mp4?sig=x', key: 'Video|u1|https://files.realman.cz/v.mp4' })
  assert.equal(m.photos[0].hash, 'h1')
})

test('popis: HTML a jednotlivé řádky na odstavce', () => {
  assert.equal(normalizeDescription('<p>A&nbsp;b</p><p>C<br>D</p>'), 'A b\n\nC\nD')
  assert.equal(normalizeDescription('A\r\n\r\n\r\nB'), 'A\n\nB')
})
