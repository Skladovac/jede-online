# dohazka.jede.online — návrh

Datum: 2026-11-08
Stav: návrh k odsouhlasení (nic se ještě nestaví). Prošel kontrolou reviewera,
který by podle něj stavěl; jeho výhrady jsou zapracované.

## Proč to vzniká

Kamarád majitele jede.online si vede docházku na papíře a ten papír pak předává
zaměstnavateli jako výkaz. Papír se ztrácí, zpětně si nepamatuje, kolik kde
odpracoval, a na konci měsíce to dohledává.

Dohazka ten papír nahradí. Webová aplikace, kterou si dá na plochu telefonu.
Každý den v 19:00 mu pípne oznámení, on ve dvou kliknutích zapíše
hodiny a místo, a na konci měsíce vyexportuje soubor, který zaměstnavatel vezme
místo papíru.

Zatím jeden uživatel (ten kamarád), časem možná tým lidí. Proto je od začátku
přihlášení a data oddělená po uživatelích — ne proto, že to teď někdo potřebuje,
ale aby se kvůli druhému člověku nepřepisovala polovina aplikace.

## Cíle

1. **Zápis jednoho dne na telefonu do patnácti sekund.** Hodiny a místo, uložit.
   Všechno ostatní je schované.
2. **Oznámení každý den v 19:00.** Bez něj si kamarád zapisovat nebude a
   aplikace je k ničemu. Toto je ta funkce, kvůli které to celé vzniká.
3. **Export měsíce v PDF, Excelu a CSV.** Ze stejných dat, aby zaměstnavatel
   dostal, co umí přečíst.
4. **Vidí, co nemá zapsané.** Dny bez záznamu jsou v měsíci poznat, takže na
   konci měsíce nehledá děravá místa. Nejsou ale označené jako chyba — kamarád
   pracuje nepravidelně včetně víkendů, takže aplikace neví, kdy pracovat měl.
5. **Víc uživatelů bez přepisování.** Druhý člověk = nový účet, nic jiného.

## Co cíl není

Tyhle věci do první verze nepatří. Ne proto, že jsou špatné, ale protože
rozhodnutí o nich zatím nepadlo a bez nich aplikace funguje:

- Výpočet mzdy, hodinové sazby, příplatky, fakturace.
- Přístup zaměstnavatele do aplikace, schvalování výkazu, podpis.
- Automatické měření příchodu a odchodu, GPS, geofencing.
- Nativní aplikace v App Storu.
- Napojení na mzdový nebo docházkový systém.
- Zápis bez signálu (offline). Zapsat jde až když je telefon online.
- Role nadřízeného, který vidí hodiny celého týmu. Až bude tým, až bude jasné,
  co má vidět.

## Co by znamenalo selhání, i kdyby to technicky fungovalo

- **Zápis dne trvá dýl než napsat to na papír.** Pak se vrátí k papíru.
- **Oznámení nepřijde** — nebo pípá pětkrát za sebou, nebo i ve dnech, které už
  má odbyté.
- **Export, který zaměstnavatel odmítne.** Musí být čitelný a vytisknutelný na
  jednu A4 za měsíc.
- **Cizí člověk se zapíše nebo vidí kamarádovy hodiny.**
- **Ztracené zápisy.** Měsíc práce v databázi bez záloh je horší než papír,
  protože papír je vidět.

## Mantinely

- **Server.** Hetzner CX23, 178.104.231.220, vedle ostatních webů jede.online.
  Na server Elasra se nesahá, za žádných okolností.
- **Databáze.** Společný kontejner postgresu `db` v docker síti `jede_default`,
  vlastní databáze `dohazka` s vlastním uživatelem — jako u pokemonu.
- **4 GB RAM.** `next build` na serveru projde jen se swapem (už je nastavený).
  Tohle vylučuje generování PDF přes headless Chrome.
- **iPhone.** Web push na iOS funguje jen když je web přidaný na plochu
  (iOS 16.4+) a uživatel oznámení povolí. Kamarád o tom ví a dá si to na plochu.
  Aplikace mu to přesto musí při prvním spuštění říct a poznat, že na ploše
  není — jinak se bude divit, proč mu nic nepípá.
- **Čeština.** Celé rozhraní, exporty i oznámení česky. Datumy a čas v pražském
  čase (`TZ=Europe/Prague`), hodiny desetinně s čárkou (8,5).
- **Patička.** „jede.online" zlatě, prokliknuté na https://jede.online — jako na
  ostatních webech.

## Co se zapisuje

Rozhodnutí kamaráda, podle toho, co má dnes na papíře:

| Pole | Povinné | Poznámka |
|---|---|---|
| Datum | ano | |
| Hodiny | ano u práce | desetinně, 8,5 |
| Místo | ano u práce | jedno textové pole; většinou město („Zlín"), občas celá adresa |
| Od–do | ne | když ho to zajímá |
| Typ dne | ne | práce (výchozí), dovolená, nemoc, volno |
| Poznámka | ne | |

**Jeden den může mít víc míst.** Občas jede dopoledne jinam než odpoledne. Proto
den není jeden řádek v tabulce, ale seznam záznamů — každý se svými hodinami a
svým místem. Běžný den má jeden záznam a druhé místo je schované pod
rozbalovátkem, aby obvyklý případ zůstal na jedno pole. *(Moje rozhodnutí, ne
jeho.)*

**Typ dne u dovolené, nemoci a volna** nepotřebuje místo a hodiny jsou
volitelné. Je to nepovinná možnost — kdo ji nepoužije, nikdy ji nevidí.
Tlačítko „nepracoval" zapíše právě tenhle záznam s typem volno a bez hodin.

**Když vyplní od–do i hodiny a nesouhlasí to, platí hodiny.** Od–do je doplňující
údaj, ne zdroj výpočtu. Aplikace z od–do jen *nabídne* dopočet, když jsou hodiny
prázdné, a pak už do nich nesahá — jinak by přepsala číslo, které kamarád zadal
vědomě (třeba protože si odečetl pauzu). Pauzy se nikde neodečítají
automaticky; hodiny jsou to, co nahlásí. *(Moje rozhodnutí.)*

## Jak to bude postavené

Tohle jsou moje rozhodnutí, ne kamarádova ani majitelova. Vycházejí z toho, že
`pokemon/` v tomhle repu už má přesně tyhle díly odladěné na tomhle serveru.
Pokud se mají změnit, je to v pořádku — ale pak to chce říct dřív než se začne.

**Aplikace.** Nová složka `dohazka/` v repu `jede.online`, vedle `pokemon/`.
Next.js 15 (App Router), React 19, Tailwind, Prisma, TypeScript. Vlastní
`package.json`, Dockerfile a `deploy/` — samostatný compose projekt, nezávislý
na ostatních webech.

**Port.** 3500 na localhostu (pokemon má 3400), nginx před tím, certifikát
certbotem. Vzor: `pokemon/deploy/nginx-pokemon.jede.online.conf`.

**Přihlášení.** E-mail a heslo, bcrypt, session cookie `dh_session` ukládaná
jako SHA-256 do databáze — stejný vzor jako `pokemon/src/lib/auth.ts`.
**Registrace je zavřená.** Není registrační stránka. Účty zakládá skript
(`npm run user:add`), aby se tam nikdo cizí nedostal. Když přijde tým, zakládá
je tím skriptem taky.

**Oznámení.** Web Push s vlastními VAPID klíči, bez cizí služby — vzor
`pokemon/src/lib/push.ts`, včetně kontroly, že endpoint míří na skutečnou push
službu prohlížeče (ochrana proti SSRF). Service worker v `public/sw.js`,
manifest pro přidání na plochu.

Spouštění v 19:00: systemd timer na serveru (`OnCalendar=*-*-* 19:00:00
Europe/Prague`, `Persistent=true`) zavolá vnitřní endpoint chráněný
`CRON_SECRET` — vzor `pokemon/deploy/pokemon-daily.timer`. Endpoint sám
rozhoduje, komu pípnout:

- **každý den, včetně víkendů a svátků.** Kamarád pracuje nepravidelně, takže
  aplikace nemůže hádat, kdy má volno. Žádná tabulka svátků, žádný rozvrh
  pracovních dnů — o volném dni rozhoduje on tím, že den odbyde tlačítkem
  „nepracoval",
- jen uživatelům, kteří ten den nemají žádný záznam (ani „nepracoval"),
- jen uživatelům s povoleným oznámením a platným odběrem,
- jednou denně, i když se timer spustí dvakrát (zámek podle data a uživatele).

Timer běží každou hodinu a endpoint pošle jen těm, kterým právě nastala jejich
hodina — vzor `pokemon/src/app/api/cron/weekly-digest/route.ts`, který jede
hodinově a odesílá jen v 17. Čas se proto nastavuje po celých hodinách, výchozí
19:00, uložený u uživatele. Když byl server večer dole, připomínka se
**zahodí** — platí jen dvě hodiny po své hodině, aby telefon nepípal ve dvě
ráno.

**Export.** Tři formáty ze stejného datového zdroje:

- **CSV** — středníkem, s BOM, aby to český Excel otevřel správně.
- **Excel (.xlsx)** — skutečný soubor, ne CSV s jinou příponou.
- **PDF** — generované na serveru knihovnou, která kreslí přímo do PDF
  (pdfkit / pdf-lib). **Žádný headless Chrome**, na 4 GB by to server položilo.
  Potřebuje font s českou diakritikou zabalený v imagi.

Sloupce: Datum, Den, Od, Do, Hodiny, Místo, Typ, Poznámka. Pod tabulkou součet
hodin a počet dnů, v hlavičce jméno, měsíc a rok. Jeden měsíc se musí vejít na
jednu A4.

⚠️ **Rozvržení PDF čeká na fotku toho papíru.** Majitel ji dodá. Do té doby
nevím, jestli výkaz potřebuje jméno a IČO firmy, osobní číslo, podpisové řádky
zaměstnance a nadřízeného, a hlavně **jestli je obdobím kalendářní měsíc**, nebo
třeba 16. až 15. Období není detail vzhledu — sahá do datového modelu, do obou
obrazovek i do součtů. Datový model se proto staví tak, aby období bylo
odvozené z nastavení, ne zadrátované na kalendářní měsíc; samotné PDF se kreslí
až podle fotky. Zbytek aplikace na tu odpověď nečeká.

**Data.** Prisma, Postgres. Hrubý obrys — podrobnosti doladí kdo to bude stavět:

- `User` — e-mail, hash hesla, jméno, čas oznámení, vytvořeno
- `Session` — jako u pokemonu
- `Entry` — uživatel, datum, typ (práce/dovolená/nemoc/volno), hodiny, od, do,
  místo, poznámka. Víc záznamů na jeden den a uživatele.
- `PushSubscription` — uživatel, endpoint, klíče
- `ReminderLog` — uživatel + datum, aby se nepípalo dvakrát

Hodiny jako `Decimal`, ne `Float` — s plovoucí čárkou se součet za měsíc
rozchází o halíře a ve výkazu to vypadá jako chyba.

**Měsíc se neuzamyká.** Opravit zpětně jde kdykoli, i po exportu. Zámek po
předání výkazu by byl správný, ale zaměstnavatel do aplikace nevidí, takže by to
teď byla jen překážka. *(Moje rozhodnutí.)*

**Záloha.** Denní ověřovaný dump databáze systemd timerem, stejně jako
`pokemon/deploy/backup-pokemon.sh`. Bez toho se to nenasazuje — viz „co by
znamenalo selhání".

Ten dump ale padá na stejný 40GB disk téhož stroje, takže sám o sobě chrání jen
proti chybě v aplikaci, ne proti ztrátě serveru. V `DEPLOY-HANDOVER.md` je krok
„Zálohy Hetzner zapnout a ověřit, že záloha vznikla" pořád nezaškrtnutý. Proto
je **součástí nasazení dohazky ověřit, že Hetzner Backups na tom stroji běží** —
jinak je slib „nepřijdeš o zápisy" nepravdivý pro dohazku i pro všechno ostatní,
co na serveru stojí. *(Moje rozhodnutí: dump na disk + zapnuté snapshoty
stroje, žádná kopie k cizí službě.)*

## Jak to vypadá

Dvě obrazovky, obě na telefonu.

**Zápis dne.** Nahoře datum s přepínáním na předchozí a další den, otevírá se na
dnešku. Velké pole na hodiny, pod ním místo s nabídkou naposledy použitých míst
(ušetří psaní, protože jezdí pořád na stejná). Pod rozbalovátkem od–do, druhé
místo, typ dne a poznámka. Dole „Uložit" a vedle nenápadné **„Nepracoval"** —
jedno kliknutí, které den uzavře a utne připomínku. Protože se pípá každý den,
bez tohohle tlačítka by o víkendu musel buď psát nuly, nebo oznámení přehlížet.

**Měsíc.** Nahoře součet hodin a počet dnů. Pod tím seznam dnů odshora dolů; dny
bez záznamu jsou tiše šedé, ne červené — nejsou chyba, jen prázdno. Dole tři
tlačítka na export. Přepínání měsíců.

Mockup obou obrazovek viděl majitel v rozhovoru a odsouhlasil ho. Kdo to bude
stavět, má volnou ruku v detailech, ne ve struktuře.

## Drobnosti, které jsem po kontrole návrhu rozhodl sám

Reviewer, který podle tohohle dokumentu bude stavět, si vyžádal doplnění. Tyhle
věci jsem rozhodl sám, protože jsou malé a nemění, co se staví. Stojí za
přečtení — kdyby některá byla špatně, teď je nejlevnější ji otočit.

- **Zapomenuté heslo se neřeší v aplikaci.** Registrace je zavřená, uživatelů je
  jeden; heslo přehraje majitel tím samým skriptem, kterým účet zakládal.
  Žádné e-maily, žádné tokeny, žádná stránka na reset. Až bude tým, může se
  přidat.
- **Export si kamarád stáhne a pošle sám** přes sdílení v telefonu. Aplikace nic
  neodesílá, takže nepotřebuje `RESEND_API_KEY` ani šablony.
- **„Zapisuje od" je datum na uživateli**, nastavené při zakládání účtu. Měsíce
  před ním se nepočítají jako prázdné a nepípá se do nich.
- **Dopisování starých měsíců z papíru** jde den po dni přepínáním data. Hromadná
  obrazovka na zadání celého měsíce v první verzi není — kdyby se ukázalo, že ji
  potřebuje, je to malý přírůstek, ne přestavba.
- **Testy se staví jako první krok plánu.** V repu dnes žádné nejsou (ani
  testovací skript v `package.json`), takže běhové prostředí testů je součást
  práce, ne něco, co se zdědí.

## Co musí být hotové na serveru, než se nasadí

- **A záznam `dohazka.jede.online`** v DNS u WEDOSu, na 178.104.231.220. Bez něj
  neprojde certbot ani web push (iOS vyžaduje HTTPS doménu). Tohle musí udělat
  majitel — do WEDOSu se odsud nedostanu.
- **Zapnuté a ověřené Hetzner Backups** — viz Záloha výše.
- Databáze a uživatel `dohazka` v postgresu, `/opt/jede/dohazka.env`, VAPID
  klíče, `CRON_SECRET`, nginx vhost, certifikát a dvě dvojice systemd unit
  (připomínka, záloha). Tohle je podle `DEPLOY-HANDOVER.md` moje oblast a je to
  součást plánu.

## Co zbývá na toho, kdo to bude stavět

- Konkrétní knihovna na PDF a na .xlsx (mantinel: nic, co potřebuje prohlížeč).
- Který font do PDF a jak ho dostat do image.
- Jak přesně vypadá nabídka naposledy použitých míst (kolik, podle čeho řazená).
- Rozvržení a vzhled v rámci struktury výše.
- Jak se pozná, že web není na ploše, a jak se to uživateli řekne.

## Co se stane potom

Až bude návrh odsouhlasený, přijde plán (rozpad na kroky s testy), ne rovnou
kód. Nasazení na server je poslední krok plánu, ne první.
