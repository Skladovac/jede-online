// Údaje o značce a provozovateli na jednom místě.
// TODO(Ondřej): doplnit IČO a sídlo — podnikatel je musí mít na webu (§ 435 občanského zákoníku).

export const SITE = {
  name: 'Vaši realitní makléři',
  short: 'VRM',
  claim: 'Od sousedů pro sousedy.',
  team: 'Markéta a Ondřej Nedbálkovi',
  region: 'Zlín a okolí',
  description:
    'Markéta a Ondřej Nedbálkovi — realitní makléři pro Zlín a okolí. Prodej a koupě nemovitostí s osobním přístupem, profesionální prezentací a tržním odhadem ceny zdarma.',
  email: 'nedbalek@vasirm.cz',
  phone: '+420 605 012 151',
  /** Provozovatel webu — doplní se, až pošlou údaje. */
  operator: {
    name: 'Ondřej Nedbálek',
    ico: '',
    address: '',
  },
  areaServed: ['Zlín', 'Otrokovice', 'Vizovice', 'Fryšták', 'Lukov', 'Kvasice', 'Napajedla', 'Slušovice'],
} as const

export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3500').replace(/\/$/, '')

/** Indexovat jen finální doménu — pracovní verze na jede.online nesmí do Googlu jako duplikát. */
export const ALLOW_INDEXING = process.env.ALLOW_INDEXING === '1'

/** Nabídka nemovitostí na webu. Do napojení Realmanu skrytá (bez odkazů v menu a na stránkách, mimo sitemap);
 *  přímé adresy /nabidka fungují dál kvůli náhledům z administrace. Zapnout: SHOW_LISTINGS=1. */
export const SHOW_LISTINGS = process.env.SHOW_LISTINGS === '1'

export type NavItem = { href: string; label: string }

export const NAV: NavItem[] = [
  { href: '/o-nas', label: 'O nás' },
  { href: '/nabidka', label: 'Nabídka' },
  { href: '/prodej-nemovitosti', label: 'Prodávám' },
  { href: '/koupe-nemovitosti', label: 'Kupuji' },
  { href: '/kontakt', label: 'Kontakt' },
]

/** Menu webu; „Reference“ jen když nějaké zveřejněné jsou (prázdná stránka v menu nepůsobí dobře). */
export const navItems = (hasReferences: boolean): NavItem[] => {
  const nav = hasReferences ? [...NAV.slice(0, 2), { href: '/reference', label: 'Reference' }, ...NAV.slice(2)] : NAV
  return SHOW_LISTINGS ? nav : nav.filter((n) => n.href !== '/nabidka')
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
