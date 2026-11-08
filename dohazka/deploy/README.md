# Dohazka — nasazení na dohazka.jede.online

Kontrolní seznam v pořadí, jak se dělá. Server je Hetzner CX23 `178.104.231.220`
(vlastní server jede.online). **Na server Elasra se nesahá.** Dohazka má vlastní compose
projekt `dohazka`, vlastní databázi, vlastní nginx vhost a vlastní klon repa;
s ostatními weby sdílí jen síť `jede_default` a postgres kontejner `jede-db-1`.

Nic z tohoto seznamu ještě nikdy neběželo na skutečném serveru. U každého kroku čekej,
že se něco ukáže, a výstup si přečti, než půjdeš dál.

## 1. DNS (dělá majitel, u WEDOSu)

Záznam `A` pro `dohazka.jede.online` na `178.104.231.220`. Ověř: `dig +short dohazka.jede.online`.
Bez toho neprojde certbot (krok 4).

## 2. Hetzner Backups

Podle specifikace je to **podmínka nasazení**: v konzoli Hetzneru ověř, že na stroji
Backups běží. Denní `pg_dump` (krok 6) je doplněk, ne náhrada.

## 3. Databáze, env soubor, klíče

Klon repa (jednou):

```bash
git clone https://github.com/Skladovac/jede-online.git /opt/jede/dohazka-src
```

Deploy dělá `git reset --hard origin/$BRANCH` (výchozí `master`). Kód Dohazky tedy musí
být na `origin/master`, nebo spouštěj `BRANCH=<větev> ./deploy-dohazka.sh`.

Databáze — nejdřív v `init-db.sql` změň `ZMEN_HESLO` (jen písmena a číslice), pak:

```bash
docker exec -i jede-db-1 psql -U <POSTGRES_USER> -d postgres < /opt/jede/dohazka-src/dohazka/deploy/init-db.sql
```

Env soubor:

```bash
cp /opt/jede/dohazka-src/dohazka/deploy/.env.example /opt/jede/dohazka.env
chmod 600 /opt/jede/dohazka.env
```

Vyplň ho podle komentářů v `.env.example`. Hodnoty bez uvozovek.

- `DOHAZKA_DATABASE_URL=postgresql://dohazka:HESLO@db:5432/dohazka`
- `CRON_SECRET`: `openssl rand -hex 32`. **Jen hex nebo base64, nikdy uvozovky ani zpětné
  lomítko** — systemd ho skládá do řádku `header = "Authorization: Bearer <tajemství>"`
  a `"` nebo `\` by ten řádek rozbily.
- VAPID klíče: `npx web-push generate-vapid-keys`, do `VAPID_PUBLIC_KEY` a `VAPID_PRIVATE_KEY`.
  `VAPID_SUBJECT=mailto:…`.
- `DOHAZKA_PDF_FONT` nech prázdné, image má DejaVu na výchozí cestě.

## 4. nginx a certifikát

```bash
mkdir -p /opt/jede/dohazka-acme
cp /opt/jede/dohazka-src/dohazka/deploy/nginx-dohazka.jede.online.conf /etc/nginx/sites-available/dohazka.jede.online
ln -s /etc/nginx/sites-available/dohazka.jede.online /etc/nginx/sites-enabled/
```

Vhost odkazuje na certifikát, který ještě neexistuje, takže `nginx -t` teď selže.
Nejdřív vystav certifikát: dočasně zakomentuj celý druhý blok `server { listen 443 … }`,
`nginx -t && systemctl reload nginx`, pak

```bash
certbot certonly --webroot -w /opt/jede/dohazka-acme -d dohazka.jede.online
```

odkomentuj blok 443 a znovu `nginx -t`. (Cesty `sites-available`/`sites-enabled` ověř
podle toho, jak jsou uspořádané vhosty pokemonu.) Vhost **musí** posílat
`X-Real-IP` — aplikace z něj bere IP pro omezení přihlašování.

## 5. První nasazení

```bash
/opt/jede/dohazka-src/dohazka/deploy/deploy-dohazka.sh
```

Skript sám zkontroluje IP serveru, buildne image, ověří migrace, vymění kontejner, otestuje
nginx, restartuje ho a zkontroluje `/api/health` (databáze i běžící commit). Build na 4 GB
RAM potřebuje swap — ověř `swapon --show`. Ověř zvenčí:
`curl -sI https://dohazka.jede.online/api/health`.

## 6. Systemd timery (záloha a připomínka)

Dvě dvojice jednotek: `dohazka-backup.{service,timer}` (záloha DB ve 03:25) a
`dohazka-reminder.{service,timer}` (večerní push, každou hodinu v :01).

```bash
cd /opt/jede/dohazka-src/dohazka/deploy
cp dohazka-backup.service dohazka-backup.timer dohazka-reminder.service dohazka-reminder.timer /etc/systemd/system/
systemctl daemon-reload
```

**Jednotky připomínky nikdy nikde neběžely.** Psané byly na Windows pro Linux. Mechanismus
autorizace (`printf … | curl -K -`, s rozbalením `$$`→`$` a `%%`→`%`) byl ověřen proti běžící
aplikaci: bez hlavičky 401, špatné tajemství 401, správné projde a dojde do aplikace.
**Neověřeno zůstává, zda parser systemd ten řádek `ExecStart` přijme.** Proto:

```bash
systemd-analyze verify /etc/systemd/system/dohazka-reminder.service /etc/systemd/system/dohazka-reminder.timer
systemd-analyze verify /etc/systemd/system/dohazka-backup.service /etc/systemd/system/dohazka-backup.timer
systemctl start dohazka-reminder.service
journalctl -u dohazka-reminder.service -n 20 --no-pager
```

V journalu musí být úspěch (HTTP 200 z aplikace), ne `401` a ne chyba parsování.
Teprve potom zapni:

```bash
systemctl enable --now dohazka-reminder.timer dohazka-backup.timer
systemctl start dohazka-backup.service && journalctl -u dohazka-backup.service -n 5 --no-pager
```

Záloha musí skončit řádkem `Dohazka backup verified: …`.

## 7. Účet pro kamaráda

Registrace je zavřená, účty se zakládají ručně. Příkaz běží v migračním kontejneru
(má tsx i skripty a připojení k databázi):

```bash
cd /opt/jede/dohazka-src/dohazka/deploy
docker compose -f docker-compose.yml --env-file /opt/jede/dohazka.env --profile tools \
  run --rm dohazka-migrate npm run user:add -- --email jeho@email.cz --name "Jméno" --tracks-from 2026-11-01
```

Heslo se vygeneruje a vypíše jednou na konci. Předej ho bezpečnou cestou.

## 8. Na iPhonu

1. Otevři `https://dohazka.jede.online` v Safari a přihlas se.
2. Sdílet → Přidat na plochu.
3. Otevři aplikaci **z plochy** (push v iOS funguje jen u nainstalované aplikace).
4. V Nastavení povol notifikace.
5. Pošli zkušební pípnutí:

```bash
set -a; . /opt/jede/dohazka.env; set +a
printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
  | curl -fsS -X POST -K - 'http://127.0.0.1:3500/api/cron/reminder?force=1'
```

**Pozor:** zkušební pípnutí `?force=1` přes den pošle skutečný push a **nespotřebuje**
večerní připomínku — schválně, aby test neokradl uživatele o ten pravý. Důsledek: kamarádovi
ten den pípne telefon dvakrát (test a večer). Buď ho předem varuj, nebo test udělej večer.

## Další nasazení

Stačí `deploy-dohazka.sh` (po sloučení do `master`). Při selhání skript skončí hláškou
`STOP: …`; do kroku výměny kontejneru běží původní verze dál.
