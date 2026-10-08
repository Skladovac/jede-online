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
}
export default dict
