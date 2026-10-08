import type { Dict, Locale } from './config'
import skCore from './sk/core'
import skCatalog from './sk/catalog'
import skCollection from './sk/collection'
import skSocial from './sk/social'
import skAccount from './sk/account'
import skEmails from './sk/emails'
import enCore from './en/core'
import enCatalog from './en/catalog'
import enCollection from './en/collection'
import enSocial from './en/social'
import enAccount from './en/account'
import enEmails from './en/emails'

const DICTS: Record<Locale, Dict | null> = {
  cs: null,
  sk: { ...skCore, ...skCatalog, ...skCollection, ...skSocial, ...skAccount, ...skEmails },
  en: { ...enCore, ...enCatalog, ...enCollection, ...enSocial, ...enAccount, ...enEmails },
}

export const dictFor = (l: Locale) => DICTS[l]
