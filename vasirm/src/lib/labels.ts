// Popisky výčtů — sdílí je server i klientské komponenty (administrace).
import type { LeadStatus, LeadType, ListingStatus, OfferType, PropertyType } from '@prisma/client'

export const STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: 'Koncept',
  ACTIVE: 'V nabídce',
  RESERVED: 'Rezervováno',
  SOLD: 'Prodáno',
}

export const OFFER_LABEL: Record<OfferType, string> = { SALE: 'Prodej', RENT: 'Pronájem' }

export const TYPE_LABEL: Record<PropertyType, string> = {
  HOUSE: 'Rodinný dům',
  FLAT: 'Byt',
  LAND: 'Pozemek',
  COMMERCIAL: 'Komerční',
  COTTAGE: 'Chata / chalupa',
  OTHER: 'Ostatní',
}

export const TYPE_PLURAL: Record<PropertyType, string> = {
  HOUSE: 'Domy',
  FLAT: 'Byty',
  LAND: 'Pozemky',
  COMMERCIAL: 'Komerční',
  COTTAGE: 'Chaty a chalupy',
  OTHER: 'Ostatní',
}

/** Typ v URL filtru (/nabidka?typ=domy). */
export const TYPE_SLUG: Record<PropertyType, string> = {
  HOUSE: 'domy',
  FLAT: 'byty',
  LAND: 'pozemky',
  COMMERCIAL: 'komercni',
  COTTAGE: 'chaty',
  OTHER: 'ostatni',
}

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  VALUATION: 'Odhad ceny',
  VIEWING: 'Prohlídka',
  CONTACT: 'Dotaz',
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nová',
  IN_PROGRESS: 'Řeší se',
  DONE: 'Vyřízeno',
  SPAM: 'Spam',
}
