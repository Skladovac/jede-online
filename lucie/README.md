# Lucie Krampotová — Masáže Vsetín

Responzivní český web s devíti stránkami. Hotové soubory pro hosting jsou ve složce `dist`. Nevyžadují Node.js ani databázi na serveru. Node.js 20+ je potřeba pouze při úpravách a novém sestavení.

## Náhled a úpravy

```
npm run build
npm test
npm start
```

Náhled: http://127.0.0.1:4173/. Bez instalace balíčků.

- `src/site.mjs`: kontakty, firemní údaje, obě ceny, služby, FAQ, doména a testovací režim.
- `src/build.mjs`: obsah, šablony, metadata a generování stránek. Při sestavení také zmenší CSS a doplní českou sazbu (nezlomitelné mezery po jednopísmenných předložkách a spojkách, v číslech).
- `public/assets/style.css`: vzhled v čitelné podobě. Do `dist` se ukládá zmenšený.
- `public/assets/app.js`: celostránkové mobilní menu, mapa na vyžádání a jemné objevování obsahu při posouvání.
- `public/assets/`: obrázky, favicon a písma.
- `dist/`: kompletní sestavená verze. Úpravy dělejte ve zdrojích, pak spusťte build.

## Vzhled

Klidný luxusní wellness: smaragd `#064E3B` a šampaň `#F8E7C9` (potvrzené barvy), písma Cormorant Garamond a Manrope. Opakujícím se motivem je oblouk: fotografie, karty služeb, ceník i mapa mají klenutý horní okraj. Tmavé sekce navazují zaobleným předělem. Podpisem je ornament olivové větvičky.

Pohyb je nenápadný a vypíná se při nastavení „omezit pohyb“. Bez JavaScriptu je obsah i navigace plně dostupná.

## Obsah

Úvod, Masáže, O Lucii, Ceník, Dárkové poukazy, Reference, FAQ, Kontakt s mapou a informace o soukromí. Součástí jsou i 404, robots.txt, sitemap.xml, OpenGraph a strukturovaná data LocalBusiness, WebSite a BreadcrumbList. Referencím není přiděleno žádné fiktivní hodnocení. Ceny jsou DOPLNÍME, nikoli nula.

## Testovací režim

`staging: true` ponechává všechny stránky jako `noindex, follow`, aby se testovací telefon a provozovatel nedostaly do výsledků vyhledávání. Robots umožňuje načtení stránek, aby vyhledávač mohl noindex přečíst. To není ochrana přístupu.

Telefon 123 456 789, DUKE test a IČO 111111111 jsou zadané placeholdery. Před ostrým spuštěním doplňte skutečné údaje, případnou novou doménu a ověřte informace o vzdělání, poukazech a zpracování osobních údajů. Změna `staging` na false je blokována generátorem, dokud zůstávají původní testovací firemní údaje nebo telefon. Potom znovu spusťte build a testy přizpůsobte ostrému režimu.

## Nasazení

Web běží na vlastním serveru jede.online (Hetzner) jako statické soubory servírované nginxem ze složky `/opt/jede/lucie/public`. DNS: A záznam `lucie` → `178.104.231.220` ve WEDOSu. HTTPS: certifikát Let's Encrypt s automatickou obnovou, HTTP přesměrovává na HTTPS, neexistující adresa vrací skutečnou 404. Nginx posílá hlavičku `X-Robots-Tag: noindex`.

Nová verze: `sh deploy.sh`. Skript web sestaví a otestuje (při chybě nic nenahraje), ověří identitu serveru, zazálohuje předchozí verzi do `/opt/jede/lucie/backup`, novou vymění najednou a zkontroluje všechny adresy ostrého webu. Na server jde jen obsah `dist`; zdroje, testy ani `.openai` ne.

Mezipaměť: HTML se při každé návštěvě ověří u serveru (`no-cache`). Styl, skript, písma a obrázky mají v adrese otisk obsahu (`?v=…`), takže je prohlížeč smí držet rok a každá změna se přesto projeví hned.

Soubory `.htaccess` a `_headers` jsou alternativy pro Apache a statické hostingy; na současném nginx serveru se nepoužívají.

## Dárkový poukaz

`npm run poukaz` vytvoří do složky `tisk/` tiskovou předlohu dárkového poukazu pro obě délky masáže: HTML, PDF pro tiskárnu (formát DL 210 × 99 mm, spadávka 3 mm, přední a zadní strana) a PNG náhledy po ořezu, které lze poslat i SMS nebo e-mailem. Údaje bere ze `src/site.mjs`, po doplnění skutečného telefonu a provozovatele stačí příkaz spustit znovu. PDF a PNG vykresluje Chrome nebo Edge bez okna (cestu lze zadat proměnnou `CHROME`).

Na poukazu není cena. Číslo poukazu, platnost a datum vystavení se vyplňují ručně; délku platnosti a podmínky poukazu určí klientka. Dokud web běží v testovacím režimu, nese poukaz drobnou poznámku o testovacích údajích.

## Soukromí, fotografie a písma

Žádná analytika, reklamní skripty, vlastní cookies ani požadavky na externí fontové servery. Mapa Google se vloží až po kliknutí. Objednání vede pouze do telefonní nebo SMS aplikace.

Všechny fotografie jsou výřezy jednoho ilustračního zátiší vytvořeného nástrojem imagegen (`crop-*.webp`). Jsou označené jako ilustrační a nezobrazují Lucii ani skutečnou provozovnu.

Písma Cormorant Garamond a Manrope jsou místní WOFF2 soubory; licence OFL jsou v `assets/fonts`. V Cormorant Garamond (`editorial*.woff2`) je upravený háček u malých písmen č, ě, ň, ř, š, ž: původní byl vysoký 70 % výšky malých písmen a nad písmenem visel jako samostatné „v“. Háček je zmenšený a posazený blíž k písmenu ve všech tloušťkách i v kurzívě. Licence OFL úpravu dovoluje a nevyhrazuje název písma.

## Ověření

Automatické kontroly pokrývají všechny vnitřní odkazy a soubory, počet H1, jazyk, testovací SEO, JSON-LD, kontaktní odkazy, ceny, reference a odložené načtení mapy.

Vizuálně ověřeno snímky z Chromu na šířkách 320, 390 a 1440 px: všechny stránky bez vodorovného přetečení, otevřené mobilní menu (fokus uvnitř menu, Esc zavírá), verze bez JavaScriptu a pořadí fokusu z klávesnice. Kontrast hlavních dvojic barev je 7,99:1 (text na smaragdu i naopak). Automatická kontrola všech 9 stránek nenašla text pod hranicí WCAG AA (4,5:1, u velkého písma 3:1); text přes fotografie kontrola nezahrnuje. Lighthouse měření ani certifikace přístupnosti nebyly provedeny.
