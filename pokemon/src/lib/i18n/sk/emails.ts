// Překlady (sk) – oblast „emails“. Klíč = český text přesně jak je v kódu.
const dict: Record<string, string> = {
  // Obal e-mailu (vykání jako v originále)
  'Pokémon karty': 'Pokémon karty',
  'Nebo zkopírujte odkaz:': 'Alebo skopírujte odkaz:',
  'Tento e-mail byl odeslán automaticky z pokemon.jede.online. Pokud jste o nic nežádali, můžete ho ignorovat.':
    'Tento e-mail bol odoslaný automaticky z pokemon.jede.online. Ak ste o nič nežiadali, môžete ho ignorovať.',

  // Potvrzení e-mailu, hesla
  'Potvrď svůj e-mail': 'Potvrď svoj e-mail',
  'Ahoj <strong>{name}</strong>,': 'Ahoj <strong>{name}</strong>,',
  'díky za registraci. Potvrď prosím, že tento e-mail patří tobě.': 'vďaka za registráciu. Potvrď, prosím, že tento e-mail patrí tebe.',
  'Potvrdit e-mail': 'Potvrdiť e-mail',
  'Obnovení hesla': 'Obnovenie hesla',
  'Někdo (snad ty) požádal o nové heslo. Odkaz platí 1 hodinu.': 'Niekto (snáď ty) požiadal o nové heslo. Odkaz platí 1 hodinu.',
  'Nastavit nové heslo': 'Nastaviť nové heslo',
  'Heslo bylo změněno': 'Heslo bolo zmenené',
  'heslo k tvému účtu na pokemon.jede.online bylo právě změněno a ostatní přihlášená zařízení jsme odhlásili.':
    'heslo k tvojmu účtu na pokemon.jede.online bolo práve zmenené a ostatné prihlásené zariadenia sme odhlásili.',
  'Pokud jsi to nebyl(a) ty, nastav si hned nové heslo přes „Zapomenuté heslo“ a napiš nám na pokemon@jede.online.':
    'Ak si to nebol(a) ty, nastav si hneď nové heslo cez „Zabudnuté heslo“ a napíš nám na pokemon@jede.online.',
  'Zapomenuté heslo': 'Zabudnuté heslo',

  // Rodič (vykání)
  'Žádost o souhlas: účet „{name}“ na Pokémon karty': 'Žiadosť o súhlas: účet „{name}“ na Pokémon karty',
  'Dobrý den,': 'Dobrý deň,',
  'vaše dítě si na webu <strong>pokemon.jede.online</strong> založilo účet s přezdívkou <strong>{name}</strong> a uvedlo tento e-mail jako e-mail rodiče.':
    'vaše dieťa si na webe <strong>pokemon.jede.online</strong> založilo účet s prezývkou <strong>{name}</strong> a uviedlo tento e-mail ako e-mail rodiča.',
  'Web slouží k evidenci sbírky Pokémon karet a k domluvě výměn mezi sběrateli. Bez vašeho souhlasu zůstane účet omezený: profil není vidět a dítě nemůže posílat ani přijímat nabídky.':
    'Web slúži na evidenciu zbierky Pokémon kariet a na dohodu výmen medzi zberateľmi. Bez vášho súhlasu zostane účet obmedzený: profil nie je vidieť a dieťa nemôže posielať ani prijímať ponuky.',
  'Na odkazu níže uvidíte, jaké údaje dítě zadalo, a můžete souhlas udělit, údaje upravit nebo účet smazat. Odkaz si uschovejte — slouží i pro pozdější správu účtu.':
    'Na odkaze nižšie uvidíte, aké údaje dieťa zadalo, a môžete súhlas udeliť, údaje upraviť alebo účet zmazať. Odkaz si uschovajte — slúži aj na neskoršiu správu účtu.',
  'Zobrazit účet a rozhodnout': 'Zobraziť účet a rozhodnúť',
  '„{name}“ přidal(a) odkazy na sociální sítě': '„{name}“ pridal(a) odkazy na sociálne siete',
  'Účet <strong>{name}</strong> má na profilu nové odkazy (Facebook, Instagram, Aukro). Zobrazí se ostatním až po vašem schválení.':
    'Účet <strong>{name}</strong> má na profile nové odkazy (Facebook, Instagram, Aukro). Ostatným sa zobrazia až po vašom schválení.',
  'Zkontrolovat a schválit': 'Skontrolovať a schváliť',

  // Hodnocení
  '{name} tě ohodnotil(a)': '{name} ťa ohodnotil(a)',
  '{name} tě ohodnotil(a) {icon}': '{name} ťa ohodnotil(a) {icon}',
  '<strong>{name}</strong> ti dal(a) {kind} hodnocení{tag}.': '<strong>{name}</strong> ti dal(a) {kind} hodnotenie{tag}.',
  'kladné 👍': 'kladné 👍',
  'záporné 👎': 'záporné 👎',
  'Zobrazit hodnocení': 'Zobraziť hodnotenie',
  'rychle odesláno': 'rýchlo odoslané',
  'odpovídá popisu': 'zodpovedá popisu',
  'příjemná domluva': 'príjemná dohoda',
  'pomalé': 'pomalé',
  'neodpovídá popisu': 'nezodpovedá popisu',
  'neodesláno': 'neodoslané',
  '{name} tě ohodnotil(a) po výměně': '{name} ťa ohodnotil(a) po výmene',

  // Žádosti o výměnu
  'Nová žádost o výměnu od {name}': 'Nová žiadosť o výmenu od {name}',
  '<strong>{name}</strong> má zájem o {what}:': '<strong>{name}</strong> má záujem o {what}:',
  'tuto kartu': 'túto kartu',
  '{count} karet': '{count} kariet',
  'výměna': 'výmena',
  'prodej': 'predaj',
  'dar za poštovné': 'dar za poštovné',
  'za {price} Kč': 'za {price} Kč',
  'Když žádost přijmete, uvidíte navzájem e-mail a domluvíte se na předání. Web neřeší platby ani dopravu.':
    'Keď žiadosť prijmete, uvidíte navzájom e-mail a dohodnete sa na odovzdaní. Web nerieši platby ani dopravu.',
  'Zobrazit výměnu': 'Zobraziť výmenu',
  '{name} přijal(a) tvoji žádost': '{name} prijal(a) tvoju žiadosť',
  '{name} žádost odmítl(a)': '{name} žiadosť odmietol(-la)',
  'Kontakt pro domluvu najdeš v detailu výměny.': 'Kontakt na dohodu nájdeš v detaile výmeny.',
  '<strong>{name}</strong> přijal(a) žádost. Kontakt pro domluvu: <strong>{email}</strong>{parent}.':
    '<strong>{name}</strong> prijal(a) žiadosť. Kontakt na dohodu: <strong>{email}</strong>{parent}.',
  '(rodič: {email})': '(rodič: {email})',
  'Domluvte se na předání nebo zaslání. Až bude hotovo, potvrďte to na webu a ohodnoťte se.':
    'Dohodnite sa na odovzdaní alebo zaslaní. Keď bude hotovo, potvrďte to na webe a ohodnoťte sa.',
  'Nevadí — zkus kartu najít u někoho jiného.': 'Nevadí — skús kartu nájsť u niekoho iného.',
  'Kontakt na {name}': 'Kontakt na {name}',
  'Přijal(a) jsi žádost od <strong>{name}</strong>. Kontakt pro domluvu: <strong>{email}</strong>{parent}.':
    'Prijal(a) si žiadosť od <strong>{name}</strong>. Kontakt na dohodu: <strong>{email}</strong>{parent}.',
  '{name} zrušil(a) výměnu': '{name} zrušil(a) výmenu',
  'Výměna byla zrušena.': 'Výmena bola zrušená.',
  'Zobrazit': 'Zobraziť',
  'Výměna je dokončená': 'Výmena je dokončená',
  'Nezapomeň druhou stranu ohodnotit.': 'Nezabudni ohodnotiť druhú stranu.',
  '{name} potvrdil(a), že výměna proběhla': '{name} potvrdil(a), že výmena prebehla',
  'Potvrď to prosím taky, ať se kusy odečtou ze sbírek.': 'Potvrď to, prosím, tiež, nech sa kusy odpočítajú zo zbierok.',

  // Denní souhrn shod
  'vymění': 'vymení',
  'prodá': 'predá',
  'daruje': 'daruje',
  '<strong>(tvoje cena: do {max} Kč)</strong>': '<strong>(tvoja cena: do {max} Kč)</strong>',
  'koupí': 'kúpi',
  'za max. {price} Kč': 'za max. {price} Kč',
  '{count}× nabídka za tvou cenu nebo levněji': '{count}× ponuka za tvoju cenu alebo lacnejšie',
  'Nové nabídky toho, co ti chybí ({count})': 'Nové ponuky toho, čo ti chýba ({count})',
  'Někdo chce koupit, co nabízíš ({count})': 'Niekto chce kúpiť, čo ponúkaš ({count})',
  '…a dalších {count}.': '…a ďalších {count}.',
  '✅ Nabídka za tvou cenu nebo levněji': '✅ Ponuka za tvoju cenu alebo lacnejšie',
  '✅ {count} nabídky za tvou cenu nebo levněji': '✅ {count} ponuky za tvoju cenu alebo lacnejšie',
  'Někdo nabízí, co ti chybí': 'Niekto ponúka, čo ti chýba',
  'Někdo chce koupit, co nabízíš': 'Niekto chce kúpiť, čo ponúkaš',
  'od posledního e-mailu se objevily nabídky toho, co sháníš:': 'od posledného e-mailu sa objavili ponuky toho, čo zháňaš:',
  '💰 <strong>Někdo chce koupit, co nabízíš:</strong>': '💰 <strong>Niekto chce kúpiť, čo ponúkaš:</strong>',
  '<small>Tyto e-maily můžeš vypnout v <a href="{url}">Můj účet</a>.</small>':
    '<small>Tieto e-maily môžeš vypnúť v <a href="{url}">Môj účet</a>.</small>',
  'Zobrazit, kdo to nabízí': 'Zobraziť, kto to ponúka',
  'Otevřít moji sbírku': 'Otvoriť moju zbierku',
  'Pošli mi v neděli odpoledne týdenní souhrn (nové nabídky, sledující, hodnocení, zájem o moje karty).': 'Pošli mi v nedeľu poobede týždenný súhrn (nové ponuky, sledujúci, hodnotenia, záujem o moje karty).',
  'Nové nabídky karet, které ti chybí ({n})': 'Nové ponuky kariet, ktoré ti chýbajú ({n})',
  '…a další na webu.': '…a ďalšie na webe.',
  'Noví sledující: {names}': 'Noví sledujúci: {names}',
  'Nová hodnocení: 👍 {pos} · 👎 {neg}': 'Nové hodnotenia: 👍 {pos} · 👎 {neg}',
  'Tvoje nabídky ({offers}): žádosti o výměnu za týden {requests}, v košíku je má teď {carts} lidí.': 'Tvoje ponuky ({offers}): žiadosti o výmenu za týždeň {requests}, v košíku ich má teraz {carts} ľudí.',
  'Týdenní souhrn vypneš v Můj účet.': 'Týždenný súhrn vypneš v Môj účet.',
  'Tvůj týden na pokemon.jede.online': 'Tvoj týždeň na pokemon.jede.online',
  'Ahoj {name}, tohle se za poslední týden stalo kolem tvé sbírky:': 'Ahoj {name}, toto sa za posledný týždeň stalo okolo tvojej zbierky:',
  'Otevřít web': 'Otvoriť web',
  'Co všechno umí pokemon.jede.online': 'Čo všetko vie pokemon.jede.online',
  'e-mail máš potvrzený. Tady je v kostce, co web umí — ať z něj dostaneš maximum.': 'e-mail máš potvrdený. Tu je v skratke, čo web vie — nech z neho dostaneš maximum.',
  '1. Sady jako album': '1. Sady ako album',
  'Otevři sadu, kterou sbíráš, a odklikej karty, které máš. Hned vidíš, co chybí a kolik zbývá. Vyber si, co sbíráš: Base (základní karty), Complete (i secret) nebo Master (všechny varianty — normal, holo, reverse). Zobrazení „Seznam“ má políčka variant u každé karty.': 'Otvor sadu, ktorú zbieraš, a odklikaj karty, ktoré máš. Hneď vidíš, čo chýba a koľko zostáva. Vyber si, čo zbieraš: Base (základné karty), Complete (aj secret) alebo Master (všetky varianty — normal, holo, reverse). Zobrazenie „Zoznam“ má políčka variantov pri každej karte.',
  '2. Přidávání karet číslem': '2. Pridávanie kariet číslom',
  'V Moje sbírka napiš jen číslo karty, třeba „MEP 101, SVI 045, 2x 30C 071“ — web kartu pozná a přidá. Rychlé i pro celý balík.': 'V Moja zbierka napíš len číslo karty, napríklad „MEP 101, SVI 045, 2x 30C 071“ — web kartu spozná a pridá. Rýchle aj pre celý balík.',
  '3. Výměny a tržiště': '3. Výmeny a trhovisko',
  'Označ, co ti chybí, a web ti ukáže sběratele, kteří to mají — nejdřív ty, se kterými jde udělat výměnu oběma směry. Karty navíc nabídni k výměně nebo prodeji; obchod jde domluvit v chatu a potvrdit s hodnocením.': 'Označ, čo ti chýba, a web ti ukáže zberateľov, ktorí to majú — najprv tých, s ktorými ide spraviť výmenu oboma smermi. Karty navyše ponúkni na výmenu alebo predaj; obchod sa dá dohodnúť v chate a potvrdiť s hodnotením.',
  '4. Jak fungují ceny': '4. Ako fungujú ceny',
  'U každé karty je orientační cena z Cardmarketu (trend prodejů), aktualizuje se jednou denně. Částky v Kč jsou přepočet z eur kurzem ČNB — je to vodítko pro férovou výměnu, ne výkupní cena.': 'Pri každej karte je orientačná cena z Cardmarketu (trend predajov), aktualizuje sa raz denne. Sumy v Kč sú prepočet z eur kurzom ČNB — je to vodidlo pre férovú výmenu, nie výkupná cena.',
  'Podívat se na ceny': 'Pozrieť ceny',
  '5. Propoj svou AI (ChatGPT, Claude…)': '5. Prepoj svoju AI (ChatGPT, Claude…)',
  'V Můj účet si vytvoř klíč a vlož ho do své AI. Pak jí stačí poslat fotku karty a napsat „přidej do sbírky“, nebo se zeptat „které karty ze sady 151 mi chybí“. Běží to na tvém účtu u AI, u nás je to zdarma.': 'V Môj účet si vytvor kľúč a vlož ho do svojej AI. Potom jej stačí poslať fotku karty a napísať „pridaj do zbierky“, alebo sa spýtať „ktoré karty zo sady 151 mi chýbajú“. Beží to na tvojom účte pri AI, u nás je to zadarmo.',
  'Nastavit propojení': 'Nastaviť prepojenie',
  '6. Odznaky, kamarádi, chyby': '6. Odznaky, kamaráti, chyby',
  'Za sbírání a férové obchody sbíráš odznaky na profilu. Pozvi kamarády odkazem ze svého účtu. A když něco nefunguje, napiš nám přes „Nahlásit chybu“ v patičce — opravdu to čteme.': 'Za zbieranie a férové obchody zbieraš odznaky na profile. Pozvi kamarátov odkazom zo svojho účtu. A keď niečo nefunguje, napíš nám cez „Nahlásiť chybu“ v pätičke — naozaj to čítame.',
  'Otevřít pokemon.jede.online': 'Otvoriť pokemon.jede.online',
}
export default dict
