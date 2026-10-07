// Popisky sdílené mezi formuláři a výpisy (klient i server).
export const VARIANT_LABEL: Record<string, string> = {
  NORMAL: 'Normální',
  HOLO: 'Holo',
  REVERSE: 'Reverse holo',
  FIRST_EDITION: '1st edition',
  POKEBALL: 'Poké Ball reverse',
  MASTERBALL: 'Master Ball reverse',
}
export const CONDITION_LABEL: Record<string, string> = { MINT: 'Jako nová', LIGHT_PLAYED: 'Mírně hraná', DAMAGED: 'Poškozená' }
export const LANGS: [string, string][] = [
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
