# VRM — Vaši realitní makléři (vasirm.cz)

Web realitních makléřů Markéty a Ondřeje Nedbálkových (Zlín a okolí) s vlastní administrací nabídky a poptávek.
Pracovní verze běží na **vasirm.jede.online**, po schválení se přesune na **vasirm.cz** (viz níže).

Next.js 15 · Prisma + PostgreSQL · Tailwind · GSAP · sharp. Docker na Hetzneru (port `127.0.0.1:3500`), vzor `pokemon/`.

## Co web umí

- **Veřejná část:** úvod, nabídka s filtrem a řazením, detail nemovitosti (galerie přes celou obrazovku, video,
  parametry, štítek PENB, mapa až po kliknutí, orientační splátka hypotéky, formulář na prohlídku),
  Prodávám, Kupuji, **Odhad ceny zdarma** (formulář ve 3 krocích — hlavní zdroj zakázek), O nás, Kontakt, GDPR.
- **Administrace** (`/admin`): nemovitosti (texty, parametry, stav nabídka / rezervováno / prodáno / koncept,
  nahrávání fotek s automatickým zmenšením a odstraněním GPS, pořadí přetažením, video MP4 nebo YouTube),
  poptávky (stav, interní poznámka), vlastní profil a fotka, změna hesla.
- **Poptávky** se ukládají do databáze a chodí e-mailem (Brevo). Odpověď na e-mail jde rovnou zájemci.
- **SEO:** strukturovaná data (RealEstateAgent, RealEstateListing, drobečky), sitemap, OG obrázky,
  301 ze starých adres WordPressu `/nemovitost/<slug>/`. Pracovní verze má `noindex` (ALLOW_INDEXING=0).

## Napojení na Realman

Zakázky se zadávají v Realmanu; tlačítko „Exportovat na web“ je pošle sem (dokumentace Realmanu
„REST — export na externí web klienta v3“, atributy podle importu Sreality kap. 3.1).

- `POST /import/estate/{ID}` — založí / aktualizuje nemovitost (`source = REALMAN`), odpoví hned;
  fotky (JPEG z odkazů s omezenou platností) a video se stáhnou a zmenší ve frontě (`lib/realman-sync.ts`),
  nepovedené soubory se zkusí znovu (max. 3×, pak čekají na další export).
- `DELETE /import/estate/{ID}` — zakázka stažená z exportu → na webu „Prodáno“ (smazat jde ručně v administraci).
- Ověření: hlavička `apikey` = `REALMAN_API_KEY` (vlastní, ne výchozí z dokumentace) a IP Realmanu 88.86.117.161–173.
- Nemovitosti z Realmanu jsou v administraci jen ke čtení (kromě zvýraznění a smazání); přehled volání je v `/admin/realman`.
- Makléř se páruje podle e-mailu z Realmanu na účet v administraci. Developerské projekty se zatím odmítají.
- Po prvním exportu spárovat původní ruční nemovitosti (zachová 301 ze starého WordPressu):
  `… run --rm vasirm-tools npx tsx --conditions=react-server scripts/realman-merge.ts <slug> <ID zakázky> --yes`
- Do Realmanu (podpora@realman.cz) předat URL `https://<doména>/import/estate/` a klíč z `/opt/jede/vasirm-creds/realman-apikey.txt`.

## Lokální vývoj

```
npm install
cp .env.example .env
npm run db:local          # Postgres bez Dockeru na portu 5433 (nechat běžet)
npx prisma migrate deploy
npm run import:wp         # makléři + 4 nemovitosti ze starého webu (hesla do .credentials.local)
npm run dev               # http://localhost:3500
npm test                  # testy formátování (cena, slug, hypotéka…)
```

Statické fotky (portréty, hlavní fotka, ikona, OG) se dělají jednorázově: `node scripts/prepare-static.mjs <složka se zdroji>`.

## Server (první nasazení)

Jednou na serveru (`ssh jede`):

```
# 1) DNS: A záznam vasirm.jede.online -> 178.104.231.220 (WEDOS)
git clone https://github.com/Skladovac/jede-online.git /opt/jede/vasirm-src
mkdir -p /opt/jede/vasirm-media /opt/jede/vasirm-creds /opt/jede/vasirm-acme
chown 1001:1001 /opt/jede/vasirm-media /opt/jede/vasirm-creds && chmod 700 /opt/jede/vasirm-creds
# 2) databáze (heslo nahradit)
docker exec -i jede-db-1 psql -U <POSTGRES_USER> -d postgres < /opt/jede/vasirm-src/vasirm/deploy/init-db.sql
# 3) env
cp /opt/jede/vasirm-src/vasirm/deploy/.env.example /opt/jede/vasirm.env && chmod 600 /opt/jede/vasirm.env   # vyplnit
# 4) nasazení (BRANCH=… pro jinou větev než master)
/opt/jede/vasirm-src/vasirm/deploy/deploy-vasirm.sh
# 5) import ze starého webu (jednou) — hesla makléřů skončí v /opt/jede/vasirm-creds/ucty.txt
docker compose -f /opt/jede/vasirm-src/vasirm/deploy/docker-compose.yml --env-file /opt/jede/vasirm.env \
  --profile tools run --rm vasirm-tools npx tsx --conditions=react-server scripts/import-wp.ts
# 6) nginx + certifikát
cp /opt/jede/vasirm-src/vasirm/deploy/nginx-vasirm.jede.online.conf /etc/nginx/sites-available/ && ln -s …
certbot certonly --webroot -w /opt/jede/vasirm-acme -d vasirm.jede.online
# 7) denní záloha (DB + média)
cp /opt/jede/vasirm-src/vasirm/deploy/vasirm-daily.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now vasirm-daily.timer
```

Další nasazení: jen `deploy-vasirm.sh`. Nový makléř / zapomenuté heslo:
`… run --rm vasirm-tools npx tsx --conditions=react-server scripts/user-add.ts <e-mail> "<Jméno>"` (nebo `<e-mail> --reset`).

## Přesun na vasirm.cz

1. Na WEDOSu (DNS vasirm.cz): `vasirm.cz` a `www.vasirm.cz` → A `178.104.231.220`. Starý WordPress pak přestane být vidět.
2. nginx: kopie konfigurace se `server_name www.vasirm.cz vasirm.cz` (apex → 301 na www), certifikát přes certbot.
   Z `vasirm.jede.online` udělat 301 na `https://www.vasirm.cz$request_uri`.
3. `/opt/jede/vasirm.env`: `SITE_URL=https://www.vasirm.cz`, `ALLOW_INDEXING=1`, a `deploy-vasirm.sh`.
4. E-maily z domény vasirm.cz: v Brevu ověřit doménu a změnit odesílatele v `src/lib/email.ts`.
5. Google Search Console: přidat vasirm.cz a odeslat `https://www.vasirm.cz/sitemap.xml`.
   Staré adresy `/nemovitost/…` přesměrovává web sám (301).

## K doplnění od makléřů

- IČO a sídlo provozovatele (`src/lib/site.ts`) — zákon je vyžaduje na webu.
- Třída PENB u Kvasic a Chlumu (v inzerci povinná; bez průkazu se uvádí G).
- Ověřit: telefon Markéty (starý web zobrazoval 734 370 294, ale volal 734 372 294), příjmení „Nedbálek / Nedbálková“,
  plocha domu v Lukově (300 vs 190 m²), dispozice Chlum (6+2 vs 5+2) a Kvasice (6+1 vs 6+kk).
- Odsouhlasit nové texty (postup prodeje, stránky Prodávám / Kupuji / O nás, GDPR).
