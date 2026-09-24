# Lucie Krampotová — Masáže Vsetín

Responzivní český web s devíti stránkami. Hotové soubory pro běžný hosting jsou ve složce `dist`. Nevyžadují Node.js ani databázi na serveru. Node.js 20+ je potřeba pouze při úpravách a novém sestavení.

## Náhled a úpravy

```
npm run build
npm test
npm start
```

Náhled: http://127.0.0.1:4173/. Bez instalace balíčků.

- `src/site.mjs`: kontakty, firemní údaje, obě ceny, služby, FAQ, doména a testovací režim.
- `src/build.mjs`: obsah, šablony, metadata a generování stránek.
- `public/assets/style.css`: responzivní vzhled.
- `public/assets/app.js`: mobilní menu a mapa na vyžádání.
- `public/assets/`: optimalizované místní obrázky a favicon.
- `dist/`: kompletní sestavená verze. Úpravy dělejte ve zdrojích, pak spusťte build.

## Obsah

Úvod, Masáže, O Lucii, Ceník, Dárkové poukazy, Reference, FAQ, Kontakt s mapou a informace o soukromí. Součástí jsou i 404, robots.txt, sitemap.xml, OpenGraph a strukturovaná data LocalBusiness, WebSite a BreadcrumbList. Referencím není přiděleno žádné fiktivní hodnocení. Ceny jsou DOPLNÍME, nikoli nula.

## Testovací režim

`staging: true` ponechává všechny stránky jako `noindex, follow`, aby se testovací telefon a provozovatel nedostaly do výsledků vyhledávání. Robots umožňuje načtení stránek, aby vyhledávač mohl noindex přečíst. To není ochrana přístupu; citlivé testovací nasazení chraňte autentizací hostingu.

Telefon 123 456 789, DUKE test a IČO 111111111 jsou zadané placeholdery. Před ostrým spuštěním doplňte skutečné údaje, případnou novou doménu a ověřte informace o vzdělání, poukazech a zpracování osobních údajů. Změna `staging` na false je blokována generátorem, dokud zůstávají původní testovací firemní údaje nebo telefon. Potom znovu spusťte build a testy přizpůsobte ostrému režimu.

## Nasazení na lucie.jede.online

Při prvotní čtecí kontrole 22. 9. 2026 doména mířila na 185.8.237.22. HTTP vracelo parkovací stránku VEDOS. HTTPS neprošlo ověřením certifikátu a diagnostická odpověď bez jeho kontroly měla stav 401. Na původním serveru nebylo nic změněno.

1. V administraci hostingu ověřte cílový adresář subdomény. Nejdřív zálohujte jeho současný obsah a nastavení.
2. Nahrajte **obsah dist**, včetně `.htaccess`, do tohoto ověřeného adresáře. Nenahrávejte zdroje, testy ani `.openai` do veřejného adresáře. Zachovejte existující ochranu přístupu a konfiguraci, případné direktivy slučte.
3. Zajistěte platný TLS certifikát pro lucie.jede.online. Teprve po ověření HTTPS nastavte přesměrování HTTP → HTTPS v administraci hostingu.
4. Zkontrolujte /, /masaze/, /cenik/, /kontakt/, /sitemap.xml, /robots.txt a neexistující adresu. Neexistující stránka má vracet skutečný HTTP 404.
5. Otestujte mobilní menu, telefon/SMS na mobilním zařízení a načtení mapy po kliknutí.

Pro Apache je přiložena samostatná minimální `.htaccess` s cache, kompresí a 404; nenahrazujte jí bez kontroly existující nastavení. Soubor `_headers` je alternativa pro podporované statické hostingy. Žádné automatické změny DNS ani certifikátů nebyly provedeny.

Soukromý náhled přes Sites je oddělený od cílového hostingu. Jeho `.openai/hosting.json` slouží pouze tomuto náhledu. Canonical a OpenGraph URL jsou připravené pro cílovou doménu; před nasazením na ni její obrázek při sdílení ještě nebude dostupný.

## Soukromí a fotografie

Žádná analytika, reklamní skripty, vlastní cookies ani požadavky na externí fontové servery. Písma Cormorant Garamond a Manrope z oficiálního repozitáře Google Fonts jsou optimalizovaná do místních WOFF2 souborů; licence OFL jsou v assets/fonts. Mapa Google se vloží až po kliknutí. Objednání vede pouze do telefonní nebo SMS aplikace. Zátiší bylo vytvořeno nástrojem imagegen a je označeno jako ilustrační; nezobrazuje Lucii ani skutečnou provozovnu.

## Ověření

Automatické kontroly pokrývají všechny vnitřní odkazy a soubory, počet H1, jazyk, testovací SEO, JSON-LD, kontaktní odkazy, ceny, reference a odložené načtení mapy. Syntaxe skriptů ověřena. Vizuální ověření skutečným prohlížečem a Lighthouse měření nejsou dokončené: přístup k prohlížeči zablokovala kontrola zásad prostředí. Nejde o naměřené hodnocení výkonu nebo certifikaci přístupnosti.
