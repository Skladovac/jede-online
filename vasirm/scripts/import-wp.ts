// Jednorázový import makléřů a nabídky ze starého WordPressu vasirm.cz.
// Spuštění: npm run import:wp   (na serveru přes kontejner vasirm-tools, viz deploy/)
// Je opakovatelný: makléře i nemovitosti páruje podle slugu / legacySlug a už existující přeskočí.
// Texty jsou převzaté a jen opravené překlepy. Nesrovnalosti v datech jsou v TODO — ověří makléři.
import { randomBytes } from 'crypto'
import { PrismaClient, type PropertyType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { appendFile, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { MEDIA_DIR, processListingImage } from '../src/lib/media'

const prisma = new PrismaClient()
const CREDENTIALS_FILE = process.env.CREDENTIALS_FILE ?? '.credentials.local'
const WP = 'https://www.vasirm.cz/wp-content/uploads/'

const AGENTS = [
  {
    slug: 'marketa',
    name: 'Markéta Nedbálek', // TODO: na starém webu bez -ová — ověřit, jak chce být uvedena
    role: 'realitní makléřka',
    email: 'm.nedbalek@vasirm.cz',
    // TODO: na starém webu je zobrazeno 734 370 294, ale odkaz vytáčí 734 372 294 — ověřit
    phone: '+420 734 370 294',
    photo: '/img/team/marketa-800.webp',
    sort: 0,
  },
  {
    slug: 'ondrej',
    name: 'Ondřej Nedbálek',
    role: 'realitní makléř',
    email: 'nedbalek@vasirm.cz',
    phone: '+420 605 012 151',
    photo: '/img/team/ondrej-800.webp',
    sort: 1,
  },
]

type Seed = {
  slug: string
  legacySlug: string
  title: string
  propertyType: PropertyType
  locality: string
  mapQuery: string
  price: number | null
  usableArea: number | null
  landArea: number | null
  disposition: string
  energyClass: string | null
  perex: string
  description: string
  params: { label: string; value: string }[]
  agent: string
  publishedAt: string
  featured?: boolean
  images: string[]
  video?: string
}

const LISTINGS: Seed[] = [
  {
    slug: 'novostavba-pasivniho-domu-3kk-lukov',
    legacySlug: 'prodej-rodinne-domy-323-m²-zlin-chlum-2',
    title: 'Novostavba pasivního domu 3+kk',
    propertyType: 'HOUSE',
    locality: 'Lukov u Zlína',
    mapQuery: 'Lukov, okres Zlín',
    price: 13_990_000,
    usableArea: 146,
    landArea: 2000,
    disposition: '3+kk',
    energyClass: 'A',
    perex: 'Nadstandardní přízemní novostavba v kategorii pasivních domů, obložená modřínem a cedrem, se zelenou střechou a zahradou o 2 000 m².',
    featured: true,
    description: `Hezký den, ráda bych vám nabídla ke koupi nadstandardní novostavbu rodinného domu 3+kk s velkou zahradou v Lukově u Zlína. Nemovitost poskytuje naprosté soukromí na pozemku o velikosti 2 000 m².

Majitelé dbali na to, aby stavba splynula s přírodou, a tak dům obložili sibiřským modřínem a kanadským cedrem. Netypická zelená střecha skrývá vyhřívané odvody vody do vsakovací nádrže na zahradě a asi nikoho nepřekvapí, že nemovitost spadá do kategorie pasivních domů s energetickou náročností třídy A.

Tento přízemní dům je vybaven moderní kuchyňskou linkou s vestavěnými spotřebiči (sklokeramická varná deska, digestoř, elektrická trouba, mikrovlnná trouba, myčka a lednice). Dále se zde nachází 2 neprůchozí pokoje, koupelna a samostatné WC, technická místnost a úložný sklad. Ze všech obytných pokojů se dá vyjít na terasu a do zahrady, díky své orientaci jsou veškeré pokoje krásně prosvětleny. V celém interiéru jsou sádrové omítky a laminátové podlahy.

Vytápění a ohřev vody je řešen kotlem na pelety, podlahové vytápění, rekuperace vzduchu v celém domě, velkou výhodou je také studna, která sahá až do hloubky 48 m pod zemí. Další nespornou výhodou je rozvod vody a elektřiny, který vede přes celý pozemek – příprava pro zahradní dům.

S financováním vám rádi pomohou naši kolegové. V případě zájmu o další informace nebo prohlídku mne neváhejte kontaktovat. Ráda vás nemovitostí osobně provedu.`,
    params: [
      { label: 'Typ stavby', value: 'přízemní novostavba, pasivní dům' },
      { label: 'Fasáda', value: 'sibiřský modřín a kanadský cedr' },
      { label: 'Střecha', value: 'zelená (vegetační), vyhřívané odvody vody' },
      { label: 'Vytápění', value: 'kotel na pelety, podlahové topení' },
      { label: 'Větrání', value: 'rekuperace v celém domě' },
      { label: 'Voda', value: 'vlastní studna (48 m)' },
      { label: 'Zahrada', value: 'rozvod vody a elektřiny přes celý pozemek' },
    ],
    agent: 'marketa',
    publishedAt: '2026-05-12',
    video: '2026/05/Lukov.mp4',
    images: [
      '2026/05/DSC03863-scaled.jpg',
      '2026/05/DSC03783-scaled.jpg',
      '2026/05/DSC03949-scaled.jpg',
      '2026/05/DSC03871-scaled.jpg',
      '2026/05/DSC04232-scaled.jpg',
      '2026/05/DSC03967-HDR-2-Edit-scaled.jpg',
      '2026/05/DSC03973-Edit-scaled.jpg',
      '2026/05/DSC04057-scaled.jpg',
      '2026/05/DSC04163-scaled.jpg',
      '2026/05/DSC04099-HDR-Edit-scaled.jpg',
      '2026/05/DSC04135-HDR-Edit-scaled.jpg',
      '2026/05/DSC04200-HDR-Edit-scaled.jpg',
      '2026/05/DSC04167-scaled.jpg',
    ],
  },
  {
    slug: 'rodinny-dum-se-dvema-byty-lukov',
    legacySlug: 'prodej-rodinneho-domu-300-m²-lukov',
    title: 'Rodinný dům se dvěma byty 3+1',
    propertyType: 'HOUSE',
    locality: 'Lukov u Zlína',
    mapQuery: 'Lukov, okres Zlín',
    price: 8_500_000,
    // TODO: titulek starého webu uvádí 300 m², parametry 190 m² — ověřit
    usableArea: 190,
    landArea: 1300,
    disposition: '2× 3+1',
    energyClass: 'G',
    perex: 'Dům rozdělený na dvě samostatné bytové jednotky 3+1 s vlastními vstupy, na pozemku 1 300 m². Ideální pro vícegenerační bydlení nebo jako investice.',
    description: `Hezký den, nabízím vám ke koupi rodinný dům v obci Lukov, který je rozdělen na dvě samostatné bytové jednotky 3+1, každá s vlastním vstupem. Nemovitost tak poskytuje ideální příležitost pro vícegenerační bydlení, případně jako investiční příležitost s možností pronájmu jedné či obou jednotek. Dům je možné také upravit na dvojdům dle vlastních představ nového majitele.

Součástí prodeje je prostorný pozemek o celkové výměře 1 300 m², který nabízí dostatek soukromí i prostoru pro zahradu, relaxaci či další využití.

Nemovitost je napojena na veškeré inženýrské sítě. Každá bytová jednotka má vlastní měření energií (elektroměr, plynoměr, podružný vodoměr), vytápění zajišťují nové plynové kotle. Dům je v udržovaném stavu, s částečnými rekonstrukcemi interiéru. Samozřejmostí jsou plastová okna.

V současné době je jedna bytová jednotka obsazena nájemníky, což může být výhodou pro investory hledající okamžitý výnos.

Obec Lukov patří mezi oblíbené lokality díky kompletní občanské vybavenosti a klidnému prostředí. Nechte se oslovit výbornou dostupností do centra Zlína a možnostmi, které tato nemovitost nabízí, a neváhejte mě kontaktovat pro více informací nebo osobní prohlídku. S financováním této nemovitosti vám rádi pomohou kolegové.

Průkaz energetické náročnosti budovy nebyl předložen, dle platné legislativy uvádíme energetickou třídu náročnosti G.`,
    params: [
      { label: 'Bytové jednotky', value: '2× 3+1, každá s vlastním vstupem' },
      { label: 'Vytápění', value: 'nové plynové kotle, každá jednotka zvlášť' },
      { label: 'Měření energií', value: 'samostatné pro každou jednotku' },
      { label: 'Stav', value: 'udržovaný, částečně rekonstruovaný' },
      { label: 'Okna', value: 'plastová' },
      { label: 'Sítě', value: 'všechny inženýrské sítě' },
      { label: 'Nájem', value: 'jedna jednotka pronajatá' },
    ],
    agent: 'marketa',
    publishedAt: '2026-04-21',
    images: [
      '2026/04/DSC08315-HDR-1-scaled.jpg',
      '2026/04/DJI_20260418075125_0148_D-scaled.jpg',
      '2026/04/DJI_20260418074828_0142_D-Edit-2-scaled.jpg',
      '2026/04/DSC08264-HDR-scaled.jpg',
      '2026/04/DSC08437-scaled.jpg',
      '2026/04/DSC08363-HDR-scaled.jpg',
      '2026/04/DSC08367-scaled.jpg',
      '2026/04/DSC08396-HDR-scaled.jpg',
      '2026/04/DSC08405-scaled.jpg',
      '2026/04/DSC08457-HDR-scaled.jpg',
      '2026/04/DSC08466-scaled.jpg',
      '2026/04/DSC08412-HDR-scaled.jpg',
      '2026/04/DSC08350-scaled.jpg',
      '2026/04/DSC08352-scaled.jpg',
      '2026/04/DSC08353-scaled.jpg',
      '2026/04/DSC08468-scaled.jpg',
    ],
  },
  {
    slug: 'rodinny-dum-6-1-po-rekonstrukci-kvasice',
    legacySlug: 'rodinny-dum-61-150-m2-kvasice',
    title: 'Rodinný dům 6+1 po rekonstrukci',
    propertyType: 'HOUSE',
    locality: 'Kvasice',
    mapQuery: 'Kvasice',
    price: null,
    usableArea: 150,
    landArea: 390,
    // TODO: titulek 6+1, text 6+kk — ověřit
    disposition: '6+1',
    energyClass: null, // TODO: PENB chybí — v inzerci je povinný
    perex: 'Prostorný dvougenerační dům po kompletní a velmi zdařilé rekonstrukci v roce 2024. Připravený k okamžitému nastěhování, vybavení zůstává v ceně.',
    description: `Hezký den, nabízím vám ke koupi prostorný dvougenerační rodinný dům o dispozici 6+kk, který prošel v roce 2024 kompletní a velmi zdařilou rekonstrukcí. Nemovitost je připravena k okamžitému nastěhování bez nutnosti dalších investic a nabízí komfortní bydlení pro větší rodinu. Celková plocha pozemku je 390 m².

Při rekonstrukci byl kladen důraz na kvalitu provedení i energetickou úspornost. Dům má nové zateplení fasády (18 cm polystyren) a novou fasádu, střecha je zateplená 30 cm izolace s pochozí krytinou Fatrafol. Zateplen byl také strop sklepa a podlahy v přízemí. Samozřejmostí je výměna oken a balkonových dveří za tříkomorová, která zajišťují lepší tepelný i akustický komfort.

Interiér domu prošel kompletní modernizací – nové omítky, interiérové dveře s obložkovými zárubněmi, nové podlahy (plovoucí laminátové podlahy a keramická dlažba). V přízemí byly kompletně vyměněny rozvody elektřiny. O vytápění se stará nový plynový kotel značky Brötje včetně nových rozvodů a radiátorů.

Velkou předností domu jsou nové moderní koupelny s kvalitními obklady a dlažbou, které jsou vybaveny vanou, sprchovým koutem, umyvadly se skříňkami a moderními bateriemi. Dominantou obytného prostoru je nová kuchyňská linka s vestavěnými spotřebiči – indukční varná deska, digestoř, elektrická trouba, mikrovlnná trouba a myčka nádobí. Interiéru dodávají elegantní vzhled také nově obložené schody s nerezovým zábradlím. Rekonstrukcí prošly i balkony, které mají novou dlažbu a nerezové zábradlí.

Na pozemku se nachází samostatný zahradní domek, který byl rovněž kompletně zrekonstruován – nové vnitřní i venkovní omítky s obkladem, nová střecha, nové rozvody, bojler na ohřev vody, nové dveře a okno. K domku byla přistavěna pergola, která vytváří příjemné místo pro posezení. Součástí úprav je také nově vybudovaná terasa.

Velkou výhodou je, že veškeré vybavení a nábytek zůstává součástí prodejní ceny, což umožňuje okamžité pohodlné bydlení bez dalších investic. Dům představuje ideální volbu pro ty, kteří hledají prostorné, moderní a kompletně zrekonstruované rodinné bydlení.

V případě zájmu o více informací nebo prohlídku mě neváhejte kontaktovat. S financováním této nemovitosti vám rádi pomohou kolegové.`,
    params: [
      { label: 'Rekonstrukce', value: 'kompletní, 2024' },
      { label: 'Zateplení', value: 'fasáda 18 cm, střecha 30 cm' },
      { label: 'Vytápění', value: 'nový plynový kotel Brötje, nové radiátory' },
      { label: 'Okna', value: 'nová, tříkomorová' },
      { label: 'Vybavení', value: 'nábytek a spotřebiče zůstávají v ceně' },
      { label: 'Na pozemku', value: 'zahradní domek s pergolou, terasa' },
    ],
    agent: 'marketa',
    publishedAt: '2026-04-21',
    images: [
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc07946-hdr-cb4681.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc07901-hdr-0228ba.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc07976-hdr-fa2d78.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08153-hdr-b47694.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08163-hdr-b960c4.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08094-hdr-edit-da579c.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08033-hdr-edit-ace7b0.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08108-b3fc6c.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc07994-hdr-edit-80b644.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08081-hdr-edit-b75ee4.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08040-hdr-604b2b.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08124-hdr-2d13f4.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08128-d475fe.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08060-hdr-662428.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-dsc08013-hdr-31c2b9.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-photo-2026-03-13-12-34-29-2-1dc6ca.jpg',
      '2026/04/rodinny-dum-6-1-150-m2-kvasice-photo-2026-03-13-12-34-29-99950d.jpg',
    ],
  },
  {
    slug: 'rodinny-dum-6-2-se-zahradou-zlin-chlum',
    legacySlug: 'prodej-rodinne-domy-323-m²-zlin-chlum',
    title: 'Rodinný dům 6+2 se zahradou',
    propertyType: 'HOUSE',
    locality: 'Zlín – Chlum',
    mapQuery: 'Chlum, Zlín',
    price: 6_480_000,
    usableArea: 323,
    landArea: 1366,
    // TODO: text 6+2, parametry starého webu 5+2 — ověřit
    disposition: '6+2',
    energyClass: null, // TODO: PENB chybí — v inzerci je povinný
    perex: 'Dvougenerační dům v klidné lokalitě u lesa s pozemkem 1 366 m², dílnou a bytem 1+kk v přízemí. Vhodný k rekonstrukci podle vlastních představ.',
    description: `Hezký den, rád bych vám nabídl ke koupi rodinný dům 6+2 se zahradou v místní části Zlína – Chlum. Plocha pozemku je 1 366 m². Nemovitost se nachází ve velmi klidné lokalitě u lesa.

K nemovitosti se dostanete po asfaltové cestě, velkým benefitem jsou parkovací stání přímo před domem, ale také velké garážové stání.

Nemovitost byla postavena v roce 1980 jako dvougenerační dům, je v udržovaném stavu a vhodná k rekonstrukci dle vlastních představ.

V přízemí naleznete velkou dílnu, bytovou jednotku 1+kk, vstupní halu, kotelnu a šatnu. V patře jsou tři pokoje, kuchyně, obývací prostor, koupelna s vanou, WC, komora, galerie nad obývacím prostorem, pracovna a půda, kterou lze využít jako další úložný prostor.

Dům je vytápěn kotlem na tuhá paliva, ohřev vody je řešen přes bojler. Součástí kotelny je také zásobník na tuhá paliva. Inženýrské sítě: voda, veřejná kanalizace, elektřina 230/400 V.

Díky své dispozici může dům nabídnout dvougenerační bydlení, popřípadě lze nemovitost využít i jako investiční příležitost a rozdělit na bydlení a nájemní byt. Velkou výhodou je dílna, kde můžete realizovat i menší podnikání.

Součástí domu je zahrada s menší dřevěnou hospodářskou budovou a ovocnými stromy. Díky své poloze vám nabídne naprostý klid a soukromí s krásným výhledem na okolní lesy.

Pokud vás nabídka zaujala, rád vám poskytnu další informace, nebo si rovnou můžeme domluvit prohlídku a nemovitostí vás osobně provedu. Se zajištěním nejvýhodnějšího financování vám pomohou mí kolegové.`,
    params: [
      { label: 'Rok výstavby', value: '1980' },
      { label: 'Stav', value: 'udržovaný, vhodný k rekonstrukci' },
      { label: 'Vytápění', value: 'kotel na tuhá paliva' },
      { label: 'Ohřev vody', value: 'bojler' },
      { label: 'Sítě', value: 'voda, veřejná kanalizace, elektřina 230/400 V' },
      { label: 'Parkování', value: 'stání před domem, garáž' },
      { label: 'V přízemí', value: 'dílna a bytová jednotka 1+kk' },
    ],
    agent: 'ondrej',
    publishedAt: '2026-04-21',
    images: [
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05500-e9cd1a.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05231-d03ba6.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05255-e2c212.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05267-edit-8319fa.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05274-f1cc37.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05278-edit-6ab80e.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05421-18731a.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05401-519ddd.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05380-4b18eb.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05290-edit-e05454.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05358-32f46f.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05362-ac76bb.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05405-0f4fbe.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05391-fad875.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05427-ffc293.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05453-8b4f6b.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05459-616287.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05541-edit-a904c6.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05285-8f503e.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-dsc05331-18f7b7.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-1-1-1f6575.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-1-3-30092b.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-2-1-8a1ed5.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-2-3-e92fbb.jpg',
      '2026/04/prodej-rodinne-domy-323-m2-zlin-chlum-3-1-c2a3c2.jpg',
    ],
  },
]

async function download(url: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
}

async function main() {
  // ── makléři ──
  const agentIds: Record<string, string> = {}
  for (const a of AGENTS) {
    const existing = await prisma.user.findUnique({ where: { slug: a.slug } })
    if (existing) {
      agentIds[a.slug] = existing.id
      continue
    }
    const password = randomBytes(9).toString('base64url')
    const user = await prisma.user.create({
      data: {
        slug: a.slug,
        name: a.name,
        role: a.role,
        email: a.email,
        publicEmail: a.email,
        phone: a.phone,
        photo: a.photo,
        sort: a.sort,
        passwordHash: await bcrypt.hash(password, 12),
      },
    })
    agentIds[a.slug] = user.id
    // Hesla nevypisovat do terminálu/logu — jdou do souboru jen pro správce (předá je makléřům).
    await appendFile(CREDENTIALS_FILE, `${a.name}\t${a.email}\t${password}\n`, { mode: 0o600 })
    console.log(`Makléř ${a.name}: účet založen, heslo v ${CREDENTIALS_FILE}`)
  }

  // ── nemovitosti ──
  for (const l of LISTINGS) {
    if (await prisma.listing.findFirst({ where: { OR: [{ slug: l.slug }, { legacySlug: l.legacySlug }] } })) {
      console.log(`= ${l.title} (už existuje)`)
      continue
    }
    const listing = await prisma.listing.create({
      data: {
        slug: l.slug,
        legacySlug: l.legacySlug,
        title: l.title,
        status: 'ACTIVE',
        offerType: 'SALE',
        propertyType: l.propertyType,
        locality: l.locality,
        mapQuery: l.mapQuery,
        price: l.price,
        usableArea: l.usableArea,
        landArea: l.landArea,
        disposition: l.disposition,
        energyClass: l.energyClass,
        perex: l.perex,
        description: l.description,
        params: l.params,
        featured: l.featured ?? false,
        agentId: agentIds[l.agent],
        publishedAt: new Date(l.publishedAt),
      },
    })
    let sort = 0
    for (const file of l.images) {
      const img = await prisma.listingImage.create({
        data: { listingId: listing.id, sort: sort++, width: 0, height: 0, sizes: [], alt: `${l.title}, ${l.locality} — foto ${sort}` },
      })
      const out = await processListingImage(listing.id, img.id, await download(WP + file))
      await prisma.listingImage.update({ where: { id: img.id }, data: out })
      process.stdout.write('.')
    }
    if (l.video) {
      const rel = path.posix.join('l', listing.id, `video-${randomBytes(6).toString('base64url')}.mp4`)
      await mkdir(path.join(MEDIA_DIR, 'l', listing.id), { recursive: true })
      await writeFile(path.join(MEDIA_DIR, rel), await download(WP + l.video))
      await prisma.listing.update({ where: { id: listing.id }, data: { videoPath: rel } })
    }
    console.log(`\n+ ${l.title} (${l.images.length} fotek${l.video ? ', video' : ''})`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
