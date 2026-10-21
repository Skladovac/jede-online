// Texty sdílené více stránkami. Vychází z textů starého webu; co je nové, musí makléři odsouhlasit.

export const SALE_STEPS: [string, string][] = [
  ['Schůzka a odhad ceny', 'Nemovitost si prohlédneme, probereme vaše plány a připravíme tržní odhad zdarma.'],
  ['Příprava a prezentace', 'Profesionální fotografie, videoprohlídka, záběry z dronu a půdorysy. Aby nemovitost zaujala na první pohled.'],
  ['Inzerce a prohlídky', 'Nabídku dostaneme k těm správným lidem. Prohlídky vedeme osobně, vy nemusíte nic organizovat.'],
  ['Vyjednání a smlouvy', 'Vyjednáme nejlepší možnou cenu a pohlídáme smlouvy, úschovu i financování kupujícího.'],
  ['Předání klíčů', 'Provedeme vás převodem na katastru až po předávací protokol a přepis energií.'],
]

/** Checklist pro stránku „Co dělá makléř“. Nový text — makléři ho musí odsouhlasit. */
export type ChecklistPhase = { title: string; items: string[] }

export const CHECKLIST_SALE: ChecklistPhase[] = [
  {
    title: 'První schůzka a cena',
    items: [
      'Prohlédneme nemovitost a probereme vaše plány, termíny a představy.',
      'Připravíme tržní odhad ceny podle skutečně prodaných nemovitostí v okolí.',
      'Navrhneme prodejní cenu a strategii prodeje.',
      'Podepíšeme zprostředkovatelskou smlouvu s jasnými podmínkami a provizí.',
    ],
  },
  {
    title: 'Prověření a dokumenty',
    items: [
      'Zkontrolujeme výpis z katastru: vlastníky, zástavy, věcná břemena a exekuce.',
      'Dohledáme nabývací listinu, snímek katastrální mapy a stavební dokumentaci.',
      'Zajistíme průkaz energetické náročnosti budovy (PENB), který zákon při prodeji vyžaduje.',
      'U bytu obstaráme podklady od SVJ nebo družstva: stanovy, potvrzení o nedoplatcích a výši fondu oprav.',
      'Když na nemovitosti vázne hypotéka, domluvíme s bankou její splacení z kupní ceny.',
    ],
  },
  {
    title: 'Příprava a prezentace',
    items: [
      'Poradíme, jak nemovitost připravit, aby na fotkách i při prohlídce působila co nejlépe.',
      'Pořídíme profesionální fotografie, videoprohlídku a záběry z dronu.',
      'Nakreslíme přehledné půdorysy.',
      'Napíšeme popis, který vyzdvihne to podstatné a nic nezamlčí.',
    ],
  },
  {
    title: 'Inzerce',
    items: [
      'Zveřejníme nabídku na Sreality.cz a dalších realitních portálech.',
      'Nabídku dáme i na náš web.',
      'Oslovíme zájemce, kteří u nás už hledají.',
      'Průběžně vám hlásíme, kolik lidí se o nemovitost zajímá.',
    ],
  },
  {
    title: 'Prohlídky',
    items: [
      'Domlouváme termíny prohlídek, vy nemusíte nic organizovat.',
      'Zájemce předem prověříme, ať chodí jen ti, kdo to myslí vážně.',
      'Prohlídky vedeme osobně a odpovídáme na všechny dotazy.',
      'Po každé prohlídce vám předáme zpětnou vazbu.',
    ],
  },
  {
    title: 'Vyjednání a rezervace',
    items: [
      'Vyjednáme nejlepší možnou cenu a podmínky prodeje.',
      'Ověříme, jak bude kupující platit: z vlastních zdrojů, nebo hypotékou.',
      'Uzavřeme s kupujícím rezervační smlouvu.',
    ],
  },
  {
    title: 'Smlouvy a peníze',
    items: [
      'Zajistíme kupní smlouvu a smlouvu o úschově kupní ceny.',
      'Peníze kupujícího leží v advokátní, notářské nebo bankovní úschově, dokud není převod zapsaný.',
      'Pomůžeme s podklady pro banku kupujícího, například s odhadem a zástavní smlouvou.',
      'Domluvíme podpis smluv s úředně ověřenými podpisy.',
    ],
  },
  {
    title: 'Katastr',
    items: [
      'Podáme návrh na vklad vlastnického práva do katastru nemovitostí.',
      'Hlídáme řízení až do zápisu nového vlastníka.',
      'Po zápisu dohlédneme, aby peníze z úschovy dorazily na váš účet.',
    ],
  },
  {
    title: 'Předání',
    items: [
      'Sepíšeme předávací protokol včetně stavů všech měřidel.',
      'Pomůžeme s přepisem elektřiny, plynu a vody.',
      'Připomeneme, kdy se z prodeje platí daň z příjmů a kdy ne.',
      'Předáme klíče novému majiteli.',
    ],
  },
]

export const CHECKLIST_BUY: ChecklistPhase[] = [
  {
    title: 'Co hledáte',
    items: [
      'Probereme, jaké bydlení hledáte: lokalitu, velikost, rozpočet a termín.',
      'Pomůžeme ověřit, na jakou hypotéku dosáhnete. S financováním vám rádi pomohou naši kolegové.',
    ],
  },
  {
    title: 'Hledání',
    items: [
      'Vyhledáváme a třídíme nabídky za vás.',
      'Ozveme se, jakmile se objeví něco, co vám sedne.',
      'Domluvíme prohlídky a upozorníme na to, co by vám mohlo uniknout.',
    ],
  },
  {
    title: 'Prověření nemovitosti',
    items: [
      'Zkontrolujeme katastr: kdo je vlastník, zástavy, věcná břemena a exekuce.',
      'U bytu prověříme SVJ nebo družstvo: dluhy, fond oprav a plánované opravy.',
      'U domu a pozemku prověříme územní plán, přístupovou cestu a inženýrské sítě.',
      'Upozorníme na vady a na to, co bude potřeba opravit.',
    ],
  },
  {
    title: 'Vyjednání',
    items: ['Vyjednáme cenu a podmínky koupě.', 'Projdeme s vámi rezervační smlouvu, ať víte, co podepisujete.'],
  },
  {
    title: 'Financování a smlouvy',
    items: [
      'Pomůžeme s podklady pro hypotéku, například s odhadem pro banku a zástavní smlouvou.',
      'Zkontrolujeme kupní smlouvu i smlouvu o úschově.',
      'Vaše peníze leží v bezpečné úschově, dokud nejste zapsaní jako vlastníci.',
    ],
  },
  {
    title: 'Převod a předání',
    items: [
      'Pohlídáme vklad do katastru až do zápisu vašeho vlastnictví.',
      'Nemovitost převezmete s předávacím protokolem a stavy měřidel.',
      'Pomůžeme s přepisem energií.',
      'Připomeneme přiznání k dani z nemovitých věcí do 31. ledna dalšího roku.',
    ],
  },
]

export const WHY_US = [
  'Nejsme velká korporace s anonymním call centrem. Jsme manželé, kteří milují reality a Zlín znají jako své boty. Ke každému prodeji i nákupu přistupujeme s osobním nasazením, jako bychom řešili vlastní bydlení.',
  'Zakládáme si na absolutní upřímnosti, perfektní prezentaci a právní jistotě. S námi přesně víte, na čem jste, od první schůzky až po předání klíčů.',
]
