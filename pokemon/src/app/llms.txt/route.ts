import { prisma } from '@/lib/prisma'

// /llms.txt — stručný popis webu pro AI asistenty (ChatGPT, Claude, Perplexity…): co tu najdou a kde.
// Formát podle návrhu llmstxt.org (Markdown). Čísla jsou živá z databáze.
const BASE = 'https://pokemon.jede.online'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [sets, cards, products, offers, auctions] = await Promise.all([
    prisma.cardSet.count({ where: { game: 'pokemon' } }),
    prisma.card.count(),
    prisma.product.count(),
    prisma.collectionItem.count({ where: { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } }),
    prisma.auction.count({ where: { hiddenAt: null, endsAt: { gt: new Date() } } }),
  ])
  const body = `# pokemon.jede.online

> Bezplatná komunita sběratelů Pokémon TCG karet z Česka a Slovenska: evidence sbírky, chybějící karty v sadách, ceny z Cardmarketu, výměny, tržiště a přehled aukcí. Rozhraní česky, slovensky a anglicky. Neoficiální fanouškovský projekt (Pokémon je ochranná známka Nintendo / The Pokémon Company).

Free Pokémon TCG collector community for Czechia and Slovakia: collection tracking, missing cards per set, Cardmarket prices (EUR and CZK), trading between collectors, a marketplace and an overview of auctions running on Facebook, Aukro, Vinted, Bazoš and eBay.

Aktuálně: ${sets} sad, ${cards} karet (anglické i japonské sady), ${products} zapečetěných produktů (ETB, booster boxy…), ${offers} nabídek karet na tržišti, ${auctions} probíhajících aukcí.

## Katalog (veřejné, vhodné k citaci)

- [Všechny sady](${BASE}/sady): seznam anglických sad od nejnovějších; japonské sady: ${BASE}/sady?jazyk=ja
- Sada: ${BASE}/sady/{id-sady} — všechny karty sady s orientačními cenami (např. ${BASE}/sady/sv03.5 = sada 151)
- Mapa webu: https://pokemon.jede.online/sitemap_index.xml
- Karta: ${BASE}/karta/{id-karty} — název, sada, číslo, vzácnost, typ, cena (Cardmarket trend, průměry 1/7/30 dní, přepočet na Kč kurzem ČNB), kdo ji nabízí nebo chce koupit (např. ${BASE}/karta/sv03.5-199)
- [Produkty](${BASE}/produkty): ETB, booster boxy a další zapečetěné produkty s cenami; detail ${BASE}/produkt/{id}

## Komunita

- [Tržiště](${BASE}/trziste): karty na prodej, na výměnu a poptávky „koupím“ od sběratelů z ČR a SR
- [Aukce](${BASE}/aukce): aukce karet a produktů probíhající na jiných webech, s časem konce a archivem skončených
- [Nejlépe hodnocení sběratelé](${BASE}/hodnoceni)
- Veřejný profil sběratele: ${BASE}/@{přezdívka} — co nabízí a co hledá (jen u profilů, které to povolily)
- [Bezpečný obchod](${BASE}/bezpecny-obchod): rady, jak bezpečně měnit a prodávat karty

## Poznámky

- Ceny jsou orientační (Cardmarket, aktualizace jednou denně); skutečná cena závisí na stavu karty a nabídce.
- Web neřeší platby ani dopravu; výměny a prodej si sběratelé domlouvají sami. Děti mají účty se souhlasem rodiče.
- Soukromé stránky (sbírka uživatele, účet, košík, žádosti) nejsou veřejné.
- Kontakt: pokemon@jede.online
`
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
