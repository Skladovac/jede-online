import type { ProductKind } from '@prisma/client'

export const KIND_LABEL: Record<ProductKind, string> = {
  BOOSTER: 'Booster',
  DISPLAY: 'Booster box / bundle',
  ETB: 'Elite Trainer Box',
  TIN: 'Tin',
  BLISTER: 'Blistr',
  BOX_SET: 'Kolekce / box',
  THEME_DECK: 'Balíček (deck)',
  TRAINER_KIT: 'Trainer kit',
  COIN: 'Mince',
  OTHER: 'Ostatní',
}

export const PRODUCT_LANGS: [string, string][] = [
  ['en', 'angličtina'],
  ['de', 'němčina'],
  ['fr', 'francouzština'],
  ['it', 'italština'],
  ['es', 'španělština'],
  ['ja', 'japonština'],
  ['ko', 'korejština'],
  ['zh', 'čínština'],
  ['other', 'jiný'],
]
