// Převod exportu z Realmanu (REST, „Dokumentace exportu na externí web klienta v3“) na naši nemovitost.
// Atributy jsou podle importu Sreality (kap. 3.1); Realman posílá `estate` (kódy) i `estate_readable` (čitelné hodnoty).
// Čistě datová funkce bez serveru — kvůli testům (realman.test.ts).
import type { ListingStatus, OfferType, PropertyType } from '@prisma/client'

type Obj = Record<string, unknown>

export type RealmanPhoto = { url: string; hash: string; title: string; order: number }
export type RealmanVideo = { kind: 'file'; url: string; key: string } | { kind: 'youtube'; id: string }

export type MappedEstate = {
  title: string
  offerType: OfferType
  propertyType: PropertyType
  status: ListingStatus
  price: number | null
  priceNote: string
  usableArea: number | null
  landArea: number | null
  disposition: string
  energyClass: string | null
  description: string
  locality: string
  mapQuery: string
  params: { label: string; value: string }[]
  updated: string
  isProject: boolean
  sellerEmail: string
  photos: RealmanPhoto[]
  video: RealmanVideo | null
}

const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
/** Realman popisuje kolekce jako { {..}, {..} } — v JSON to může přijít jako pole i jako objekt s klíči. */
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).map(obj)

const str = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v.trim() : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '')

export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return v.trim() && Number.isFinite(n) ? n : null
}

const int = (v: unknown) => {
  const n = num(v)
  return n == null || n <= 0 ? null : Math.round(n)
}

const truthy = (v: unknown) => v === true || v === 1 || (typeof v === 'string' && /^(1|true|ano)$/i.test(v.trim()))

/** Čitelná hodnota: multiselect jako seznam, „m2“ → „m²“. Prázdné / „Ne“ / false vrací ''. */
function readable(v: unknown): string {
  if (Array.isArray(v)) return v.map(readable).filter(Boolean).join(', ')
  if (v === false || v === 0) return ''
  const s = str(v)
  if (!s || /^(ne|false|0)$/i.test(s)) return ''
  return s.replace(/\bm2\b/g, 'm²')
}

const FLAT_SUBTYPE: Record<number, string> = {
  2: '1+kk', 3: '1+1', 4: '2+kk', 5: '2+1', 6: '3+kk', 7: '3+1', 8: '4+kk', 9: '4+1', 10: '5+kk', 11: '5+1', 12: '6 a více', 16: 'atypický', 47: 'pokoj',
}
const ROOMS: Record<number, string> = { 1: '1 pokoj', 2: '2 pokoje', 3: '3 pokoje', 4: '4 pokoje', 5: '5 a více pokojů', 6: 'atypický' }
const ENERGY = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Parametry pro tabulku na webu: [atribut Sreality, popisek]. Hodnoty se berou z estate_readable. */
const PARAMS: [string, string][] = [
  ['advert_code', 'Číslo zakázky'],
  ['building_condition', 'Stav'],
  ['building_type', 'Stavba'],
  ['object_type', 'Typ domu'],
  ['object_kind', 'Poloha domu'],
  ['object_location', 'Umístění'],
  ['ownership', 'Vlastnictví'],
  ['floor_number', 'Podlaží'],
  ['floors', 'Počet podlaží'],
  ['object_age', 'Rok výstavby'],
  ['reconstruction_year', 'Rok rekonstrukce'],
  ['acceptance_year', 'Rok kolaudace'],
  ['floor_area', 'Celková plocha'],
  ['building_area', 'Zastavěná plocha'],
  ['garden_area', 'Zahrada'],
  ['heating', 'Topení'],
  ['heating_source', 'Zdroj topení'],
  ['water_heat_source', 'Ohřev vody'],
  ['water', 'Voda'],
  ['gully', 'Odpad'],
  ['electricity', 'Elektřina'],
  ['gas', 'Plyn'],
  ['road_type', 'Komunikace'],
  ['furnished', 'Vybavení'],
  ['elevator', 'Výtah'],
  ['easy_access', 'Bezbariérový'],
  ['parking', 'Parkovacích míst'],
  ['garage_count', 'Počet garáží'],
  ['cost_of_living', 'Náklady na bydlení'],
  ['ready_date', 'Datum nastěhování'],
]
/** Ano/ne vybavení; když existuje i plocha (*_area), ukáže se plocha. */
const FLAGS: [string, string][] = [
  ['balcony', 'Balkon'],
  ['loggia', 'Lodžie'],
  ['terrace', 'Terasa'],
  ['cellar', 'Sklep'],
  ['garage', 'Garáž'],
  ['parking_lots', 'Parkování'],
  ['basin', 'Bazén'],
  ['ftv_panels', 'Fotovoltaika'],
  ['solar_panels', 'Solární panely'],
  ['advert_low_energy', 'Nízkoenergetický dům'],
]

/** Popis ze Sreality je prostý text; případné HTML převedeme na odstavce oddělené prázdným řádkem. */
export function normalizeDescription(raw: string) {
  let s = raw
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  // Bez prázdných řádků = každý řádek je samostatný odstavec.
  if (!/\n\s*\n/.test(s)) s = s.replace(/\n+/g, '\n\n')
  return s.replace(/\n{3,}/g, '\n\n')
}

export function mapEstate(payload: unknown): MappedEstate {
  const p = obj(payload)
  const e = obj(p.estate)
  const r = obj(p.estate_readable)
  const get = (k: string) => (r[k] !== undefined && r[k] !== '' ? r[k] : e[k])

  const type = num(e.advert_type)
  const subtype = num(e.advert_subtype)
  const propertyType: PropertyType =
    type === 1 ? 'FLAT' : type === 2 ? (subtype === 33 || subtype === 43 ? 'COTTAGE' : 'HOUSE') : type === 3 ? 'LAND' : type === 4 ? 'COMMERCIAL' : 'OTHER'
  const offerType: OfferType = num(e.advert_function) === 2 ? 'RENT' : 'SALE'
  const extra = num(e.extra_info)
  const status: ListingStatus = extra === 1 ? 'RESERVED' : extra === 2 ? 'SOLD' : 'ACTIVE'

  // Cena: jen v Kč za nemovitost / za měsíc umíme ukázat číslem; jinak „na vyžádání“ + čitelná cena do poznámky.
  const priceRaw = num(e.advert_price)
  const currency = num(e.advert_price_currency) ?? 1
  const unit = num(e.advert_price_unit) ?? 1
  const notes: string[] = []
  let price: number | null = priceRaw != null && priceRaw > 1 ? Math.round(priceRaw) : null
  if (price != null && (currency !== 1 || ![1, 2].includes(unit))) {
    notes.push(readable(r.advert_price) || `${price}`)
    price = null
  }
  const note = readable(e.advert_price_text_note)
  if (note) notes.push(note)
  if (truthy(e.advert_price_negotiation)) notes.push('cena k jednání')

  let disposition = ''
  if (propertyType === 'FLAT') disposition = readable(r.advert_subtype) || (subtype ? FLAT_SUBTYPE[subtype] ?? '' : '')
  else {
    const rooms = num(e.advert_room_count)
    disposition = readable(r.advert_room_count) || (rooms ? ROOMS[rooms] ?? '' : '')
  }

  const rating = num(e.energy_efficiency_rating)
  const energyClass = rating && rating >= 1 && rating <= 7 ? ENERGY[rating - 1] : null

  const city = readable(get('locality_city'))
  const part = readable(get('locality_citypart'))
  const locality = part && part !== city ? `${city} – ${part}` : city

  const params: { label: string; value: string }[] = []
  for (const [k, label] of PARAMS) {
    const v = readable(get(k))
    if (v) params.push({ label, value: v })
  }
  for (const [k, label] of FLAGS) {
    if (!truthy(e[k]) && !truthy(r[k])) continue
    params.push({ label, value: readable(get(`${k}_area`)) || 'ano' })
  }

  const photos = list(p.photos)
    .map((f) => ({ url: str(f.url), hash: str(f.hash) || str(f.url).split('?')[0], title: str(f.title), order: num(f.order) ?? 0 }))
    .filter((f) => /^https:\/\//i.test(f.url))
    .sort((a, b) => a.order - b.order)

  let video: RealmanVideo | null = null
  for (const v of list(p.videos)) {
    const url = str(v.url)
    if (/^https:\/\//i.test(url)) {
      video = { kind: 'file', url, key: [str(v.title), str(v.updated), url.split('?')[0]].join('|') }
      break
    }
  }
  if (!video) {
    const yt = list(p.videos)
      .map((v) => str(v.hash))
      .find((h) => /^[\w-]{6,20}$/.test(h))
    if (yt) video = { kind: 'youtube', id: yt }
  }

  return {
    title: str(e.title) || readable(r.title) || 'Nemovitost',
    offerType,
    propertyType,
    status,
    price,
    priceNote: notes.join(', '),
    usableArea: int(e.usable_area),
    landArea: propertyType === 'FLAT' ? null : int(e.estate_area),
    disposition,
    energyClass,
    description: normalizeDescription(str(e.description)),
    locality,
    mapQuery: part && part !== city ? `${part}, ${city}` : city,
    params,
    updated: str(e.updated),
    isProject: num(e.project) === 1,
    sellerEmail: str(obj(p.seller).email).toLowerCase(),
    photos,
    video,
  }
}
