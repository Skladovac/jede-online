# Docházka — organizace, role a admin prostředí

> Navazuje na [2026-11-08-dohazka-jede-online-design.md](2026-11-08-dohazka-jede-online-design.md).
> Stav: **návrh k odsouhlasení**. Postaveno z rozhovoru 9. 11. 2026.

## Proč

Dnes je Docházka pro jednoho člověka: registrace je zavřená, účet zakládá příkaz na
serveru, všechno patří tomu jednomu uživateli. Má z toho být systém, do kterého se
zapojí víc firem — každá se svými lidmi, svým správcem a svou účetní.

## Čeho chceme dosáhnout

1. Založit firmu a jejího správce z webu, bez sahání na server.
2. Správce si spravuje své lidi sám, bez tebe.
3. Účetní vezme měsíc za celou firmu v jednom souboru a zavře ho.
4. Firmy o sobě navzájem nevědí.

## Čeho vědomě nechceme dosáhnout

- **Veřejná registrace.** Firmu zakládáš ty. Zůstává zavřeno.
- **Fakturace, tarify, limity.** Není to produkt na prodej, je to nástroj.
- **Schvalovací kolečko** (zaměstnanec → vedoucí → účetní). Uzávěrka měsíce stačí.
- **Změna zaměstnancova zážitku.** Zapisuje den úplně stejně jako dnes.

## Role

| | Super admin | Správce firmy | Účetní | Zaměstnanec |
|---|---|---|---|---|
| Rozsah | všechny firmy | jedna i víc | jedna i víc | **právě jedna** |
| Zakládat firmy | ✅ | — | — | — |
| Zakládat a rušit lidi | ✅ | ✅ | — | — |
| Přidělovat role | ✅ | ✅ | — | — |
| Nastavení firmy | ✅ | ✅ | — | — |
| Vidět cizí výkazy | ✅ | ✅ | ✅ | — |
| Opravit cizí zápis | ✅ | ✅ | — | — |
| Export za celou firmu | ✅ | ✅ | ✅ | — |
| Uzavřít měsíc | ✅ | ✅ | ✅ | — |
| Přehled, kdo nemá zapsáno | ✅ | ✅ | ✅ | — |
| Svůj vlastní výkaz | ✅ | ✅ | ✅ | ✅ |

Kdo má víc firem (ty, externí účetní, správce několika firem), dostane nahoře
**přepínač firmy**. Zaměstnanec ho nikdy nevidí — patří právě do jedné.

## Co přibude

### Admin prostředí (ty)
Seznam firem s počtem lidí. Založení firmy a rovnou jejího prvního správce.

### Správa lidí (správce firmy)
Seznam lidí s rolí a stavem. Přidání člověka **dvěma způsoby, správce si vybere**:

- **pozvánka e-mailem** — odkaz s omezenou platností, heslo si zvolí sám,
- **vygenerované heslo** — ukáže se jednou na obrazovce, správce ho předá osobně.

Pozvánky zároveň přinesou **obnovu zapomenutého hesla**, což dnes neumí vůbec nic.
Odejde-li člověk, deaktivuje se — záznamy zůstanou kvůli výkazům za minulé měsíce.

### Nastavení firmy
Období výkazu (kalendářní měsíc nebo 16.–15.), hodina večerní připomínky, název
firmy do hlavičky výkazu. **Dnes to visí na uživateli, přesune se to na firmu.**

### Firemní export
Jeden soubor za měsíc se všemi lidmi, **XLSX a CSV** — PDF u firemního exportu
nedává smysl, účetní to dává do mezd. Výkaz jednotlivce zůstává i v PDF.

### Uzávěrka měsíce
Účetní nebo správce měsíc uzavře, zaměstnanci do něj přestanou moct psát. Vidí, že
je zavřený. Zrušit uzávěrku může správce — se záznamem do historie.

### Přehled děr
Kdo ve firmě nemá za období zapsáno a které dny chybí.

### Historie změn
Když správce sáhne do cizího zápisu, uloží se kdo, kdy a jaká byla původní hodnota.
**Ve výkazu to vidět není** — výkaz zůstává čistý. Dohledá se, až když je spor.

## Co zůstává beze změny

Denní zápis, měsíční přehled, vlastní export, večerní push připomínka, instalace na
plochu. Zaměstnanec nepozná, že se pod tím něco změnilo — kromě toho, že mu někdo
může zavřít měsíc.

## Datový model — hrubý obrys

- **Organization** — název, název do hlavičky výkazu, `periodStartDay`, `remindHour`.
- **Membership** — uživatel × organizace × role. Tahle tabulka je to, co umožňuje
  účetní dělat víc firem.
- **Entry** dostane `organizationId`. Dnes stačí omezit dotaz na `userId`; nově musí
  být omezený i na firmu.
- **PeriodLock** — firma, období, kdo zavřel, kdy.
- **EntryChangeLog** — zápis, kdo, kdy, původní hodnoty.
- `periodStartDay` a `remindHour` se z **User** stěhují na **Organization**.

## Největší riziko

Dnešní pravidlo zní „každý dotaz omezený na `userId`". Nově je potřeba **„na userId
i na organizaci"** — a chyba tady neznamená rozbitou stránku, ale **že jedna firma
uvidí výkazy druhé**. Na tohle půjde největší díl kontroly: každá serverová akce,
každý export, každá cesta.

## Předpoklady, které jsem si doplnil

Pokud některý nesedí, řekni a opravím ho:

1. Super admin je příznak u uživatele, ne zvláštní aplikace — přihlašuje se stejně.
2. Zaměstnanec si období ani hodinu připomínky nenastavuje, platí firemní.
3. Uzávěrka se týká celé firmy najednou, ne jednotlivců.
4. Firma potřebuje jen název; IČO a adresu doplníme, až bude znát podobu papírového
   výkazu.

## Co je pořád otevřené

- **Rozvržení PDF čeká na fotku papírového výkazu.** Dokud nepřijde, zůstává to
  správná tabulka dat bez hlavičky a políček na podpis.
- **Síla hesel.** Dnes se hesla generují a jsou velmi silná. Jakmile si je lidé začnou
  volit sami, budou slabší. Navrhuji minimální délku a odmítnutí hesel ze známých
  úniků — rozhodni, jestli to chceš hned.

## Postup

Kamarád počká na verzi s firmami, takže se nasadí až hotová. To dává prostor postavit
to v pořadí, kde každý krok dává smysl sám o sobě:

1. **Firmy, členství, role** — datový model a omezení dotazů. Bez UI.
2. **Admin prostředí** — založení firmy a správce, správa lidí, pozvánky.
3. **Nastavení firmy** — období, připomínka, název do výkazu.
4. **Pohled účetní** — výkazy lidí, firemní export, přehled děr.
5. **Uzávěrka a historie změn.**
6. **Migrace** živého účtu pod firmu a nasazení.
