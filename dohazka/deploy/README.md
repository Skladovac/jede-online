# Dohazka — nasazení na dohazka.jede.online

Kontrolní seznam v pořadí, jak se dělá. Server je Hetzner CX23 `178.104.231.220`
(vlastní server jede.online). **Na server Elasra se nesahá.** Dohazka má vlastní compose
projekt `dohazka`, vlastní databázi, vlastní nginx vhost a vlastní klon repa;
s ostatními weby sdílí jen síť `jede_default` a postgres kontejner `jede-db-1`.

U každého kroku čekej, že se něco ukáže, a výstup si přečti, než půjdeš dál.

> **Kapitoly 1–8 jsou PRVNÍ instalace a na tomhle serveru už proběhly.** Nespouštěj je
> znovu: `cp .../.env.example /opt/jede/dohazka.env` (kapitola 3) i `cp` vhostu (kapitola 4)
> přepisují **živé** soubory bez varování. Přepsaný `dohazka.env` znamená ztracené
> `DOHAZKA_DATABASE_URL`, `CRON_SECRET` a **privátní VAPID klíč** — s novým klíčem přestanou
> fungovat všechny už zaregistrované push odběry a nikdo se to nedozví, jen přestanou pípat.
> **Nasazuješ-li větev „firmy a role“, jdi rovnou na kapitolu 9**; kapitoly 1–8 jsou tam jen
> jako odkazy na jednotlivé příkazy a na to, co která hodnota znamená.

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

Databáze. `deploy-dohazka.sh` dělá `reset --hard`, takže úprava souboru uvnitř klonu by
se při deployi vrátila. Zkopíruj proto `init-db.sql` ven a uprav kopii (změň `ZMEN_HESLO`,
jen písmena a číslice):

```bash
cp /opt/jede/dohazka-src/dohazka/deploy/init-db.sql /root/dohazka-init-db.sql
nano /root/dohazka-init-db.sql
PGU=$(docker exec jede-db-1 printenv POSTGRES_USER)   # DOMNĚNKA, viz níže
docker exec -i jede-db-1 psql -v ON_ERROR_STOP=1 -U "$PGU" -d postgres < /root/dohazka-init-db.sql
rm /root/dohazka-init-db.sql   # až bude vše ověřeno; obsahuje heslo, nenechávej ho ležet
```

Poznámka: že jde superuživatele postgresu zjistit přes `printenv POSTGRES_USER` v kontejneru `jede-db-1` je jen předpoklad (backup skripty pokemonu tuto proměnnou v kontejneru používají, ale na serveru jsem to neviděl). Když `PGU` vyjde prázdné, najdi uživatele v compose souboru stacku landingu.

Čekaný výstup: `CREATE ROLE` a `CREATE DATABASE`. Cokoli jiného (např. `ERROR … already exists`)
je selhání — skript se díky `ON_ERROR_STOP=1` zastaví. Ověř:

```bash
docker exec jede-db-1 psql -U "$PGU" -d postgres -c '\du dohazka' -c '\l dohazka'
```

Role `dohazka` i databáze `dohazka` (vlastník `dohazka`) musí být vidět.

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
- `RESEND_API_KEY`: klíč z Resendu (doména `jede.online` tam je ověřená). **POZOR: bez něj se
  žádný e-mail neodešle a obnova hesla tiše skončí, i když obrazovka napíše, že odkaz byl poslán.**
  Pozvánka vznikne i bez klíče (správce odkaz uvidí a předá ručně), ale zapomenuté heslo bez klíče
  nikdo neobnoví. Klíč nikdy nepiš na příkazovou řádku (zapsal by se do historie shellu);
  patří jen do `/opt/jede/dohazka.env`.
- `APP_URL`: základ odkazů v e-mailech. Prázdné = `https://dohazka.jede.online`, což je správně.
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
`X-Real-IP` — aplikace z něj bere IP pro omezení přihlašování — a `X-Forwarded-Host`,
proti kterému Next kontroluje `Origin` u serverových akcí (bez něj by prošla hodnota od klienta).

Vhost má blok `location ^~ /pozvanka/ { access_log off; … }`. Odkaz na pozvánku i na obnovu
hesla nese **jednorázový token v cestě URL** a access log by ho jinak uložil čitelně na disk
(i do rotovaných logů). Blok musí zůstat, i když vhost upravuješ. Ověř po nasazení vhostu:

```bash
nginx -T 2>/dev/null | grep -A2 'location ^~ /pozvanka/'   # blok musí být vidět
LOG=$(nginx -T 2>/dev/null | awk '$1=="access_log"{gsub(/;/,"",$2); print $2; exit}')
echo "$LOG"                                                 # skutečná cesta k logu, ne hádaná
curl -s -o /dev/null https://dohazka.jede.online/prihlaseni
grep -c '/prihlaseni' "$LOG"                                # KONTROLNÍ: musí být > 0
curl -s -o /dev/null https://dohazka.jede.online/pozvanka/zkusebni-token-neexistuje
grep -c zkusebni-token-neexistuje "$LOG"                    # musí být 0
```

**Ten kontrolní požadavek je tam schválně.** Samotná nula u tokenu nic nedokazuje — vyjde
i tehdy, když se koukáš do špatného souboru, log je vypnutý nebo ještě nevyprázdněný.
Teprve když `/prihlaseni` v logu **je** a token **není**, je to důkaz. Vyjde-li i kontrolní
řádek 0, cestu k logu hledej ručně (`nginx -T | grep access_log`, případně `lsof -p` na
proces nginxu) a kontrolu zopakuj.

Vyjde-li u tokenu víc než 0, vhost v `sites-enabled` není ten z repa, nebo nginx nenačetl
reload: porovnej `diff` s repem a udělej `nginx -t && systemctl reload nginx`.

## 5. První nasazení

```bash
/opt/jede/dohazka-src/dohazka/deploy/deploy-dohazka.sh
```

Skript sám zkontroluje IP serveru, buildne image, ověří migrace, vymění kontejner, otestuje
nginx, reloadne ho a zkontroluje `/api/health` (databáze i běžící commit). Build na 4 GB
RAM potřebuje swap — ověř `swapon --show`. Ověř zvenčí:
`curl -s https://dohazka.jede.online/api/health` — musí vrátit `"db":"up"`.

**Po každém nasazení si stáhni všechny tři exporty** (přihlas se a klikni na ně v měsíci).
Health endpoint o nich nic neříká a knihovny na PDF a XLSX jsou jediné místo, kde se
projeví chyba v zabalení buildu — ta nespadne při buildu ani v testech, jen na skutečném
exportu. PDF už jednou takhle spadlo na `#standard-fonts/Helvetica`; proto je `pdfkit`
v `next.config.ts` vyňatý z bundleru a celý kopírovaný do standalone.

Smoke test po nasazení, celý:

1. **Osobní exporty PDF, XLSX i CSV stáhnout a otevřít** (Měsíc → export). Vrátí-li PDF nebo
   Excel chybu 500 či prázdný soubor, je rozbité zabalení pdfkitu/exceljs: přečti
   `docker logs dohazka-dohazka-1 --tail 50` a komentáře v `next.config.ts`; neopravuj naslepo.
2. **Firemní CSV** (Výkazy → export firmy) otevři v **opravdovém Excelu** a podívej se, že sloupec
   „Dny bez záznamu“ je čitelný. Buňka končí závorkou, takže ji Excel nepřečte jako datum;
   ověřuje se čitelnost, ne typ buňky. Uvidíš-li tam datum nebo `#`, zapiš si to a nic neměň.
3. **Nepřihlášený** požadavek musí skončit přesměrováním, ne souborem:
   `curl -sI https://dohazka.jede.online/api/export/firma/csv` → čekej `307` nebo `302` s `location`
   na přihlášení. Přijde-li `200` a data, je to díra v oprávněních: **okamžitě aplikaci zastav**
   (`docker compose -f … --env-file … stop dohazka`) a nech to opravit.
4. Port aplikace je **3600** (3500 drží živý web `vasirm`, na ten se nesahá).
   `curl -s http://127.0.0.1:3600/api/health` musí odpovědět.
5. **Jeden skutečný e-mail:** z aplikace (Lidé → pozvat) pošli jedinou pozvánku na adresu, ke které
   máš přístup. Odesílatel je `dohazka@jede.online`; čekej doručení do minuty. Nedorazí-li,
   zkontroluj `RESEND_API_KEY` v `dohazka.env` (po změně `up -d --force-recreate dohazka`)
   a stav odeslání v Resendu. Klíč při ladění volej **jen přes `curl -K` ze serveru**, nikdy jako
   argument příkazové řádky.

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

## 7. Účty a firmy

Registrace je zavřená. Lidi do firmy normálně zve správce firmy v aplikaci (Lidé → pozvánka
e-mailem). `user:add` je zakládací a nouzová cesta: první super admin, oprava na serveru, účet
bez e-mailu. Běží v migračním kontejneru (má tsx, skripty i připojení k databázi):

```bash
cd /opt/jede/dohazka-src/dohazka/deploy
docker compose -f docker-compose.yml --env-file /opt/jede/dohazka.env --profile tools \
  run --rm dohazka-migrate npm run user:add -- <přepínače>
```

Heslo z přepínače se nebere (zůstalo by v historii shellu): vygeneruje se a vypíše **jednou**
hned po zápisu účtu. Předej ho bezpečnou cestou.

| Co chceš | Přepínače |
|---|---|
| Nový člověk do firmy | `--email a@b.cz --name "Jméno" --org <id> --role EMPLOYEE --tracks-from 2026-11-01` |
| Existující účet do další firmy | `--email a@b.cz --org <id> --role EMPLOYEE --tracks-from 2026-11-01` (u nového členství je `--tracks-from` povinné) |
| Změna role | `--email a@b.cz --org <id> --role OWNER` (aktivitu členství **nemění**) |
| Odebrat / vrátit přístup do firmy | `--email a@b.cz --org <id> --role OWNER --deactivate` / `--activate` |
| Nové heslo | `--email a@b.cz --reset-password` |
| Přejmenování | `--email a@b.cz --name "Nové jméno"` |
| Super admin | `--email a@b.cz --super-admin --reset-password` (u účtu s heslem od stroje si příkaz `--reset-password` **vynutí**, viz kapitola 9); nový účet bez firmy: `--name "Jméno" --super-admin` |

Role jsou `OWNER` (správce firmy), `ACCOUNTANT` (účetní), `EMPLOYEE` (zaměstnanec).
`--org` a `--role` se zadávají **vždy spolu**. `<id>` firmy zjistíš v databázi:

```bash
PGU=$(docker exec jede-db-1 printenv POSTGRES_USER)
docker exec jede-db-1 psql -U "$PGU" -d dohazka -c 'SELECT id, name FROM "Organization";'
```

Firma z převodu živých dat má id `org_default`.

Co příkaz odmítne (je to ochrana, ne porucha):

- *„Nový účet potřebuje --org s --role, nebo --super-admin“*: účet bez firmy by zůstal navždy
  na obrazovce „bez přístupu“.
- *„Účet má heslo, které nenastavil jeho majitel …“*: viz kapitola 9; přidej `--reset-password`,
  vypíše se nové heslo.
- *„Firma … neexistuje“*: překlep v `<id>`, zkontroluj SQL výše.

Začátek výkazového období (1–28) už není přepínač účtu, je to nastavení **firmy**:
mění ho správce v aplikaci (Nastavení firmy).

## 8. Na iPhonu

1. Otevři `https://dohazka.jede.online` v Safari a přihlas se.
2. Sdílet → Přidat na plochu.
3. Otevři aplikaci **z plochy** (push v iOS funguje jen u nainstalované aplikace).
4. V Nastavení povol notifikace.
5. Pošli zkušební pípnutí:

```bash
set -a; . /opt/jede/dohazka.env; set +a
printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
  | curl -fsS -X POST -K - 'http://127.0.0.1:3600/api/cron/reminder?force=1'
```

**Pozor:** zkušební pípnutí `?force=1` přes den pošle skutečný push a **nespotřebuje**
večerní připomínku — schválně, aby test neokradl uživatele o ten pravý. Důsledek: kamarádovi
ten den pípne telefon dvakrát (test a večer). Buď ho předem varuj, nebo test udělej večer.

## Když spadne poslední krok (smoke test)

**Pro nasazení větve s firmami a rolemi (kapitola 9) tento postup NEPLATÍ**: stará verze nové
schéma neumí. Pro všechna ostatní nasazení:

Skript v tu chvíli už vyměnil kontejner, takže rozbitá verze běží. Automatický návrat není
schválně — rozhodni ty. Skript sám vypíše přesné příkazy s hashem předchozího commitu:
`git reset --hard <předchozí>`, `build dohazka`, oprava `GIT_COMMIT` v env a
`up -d --force-recreate dohazka`. Migrace databáze se nevrací; ověř, že stará verze nové
schéma zvládne. Hranice je výměna kontejneru (`up -d --force-recreate`): když skript skončí před ní (reset, build, migrační brána, `migrate deploy`), původní kontejner běží dál a nic vracet není. Od výměny dál (`nginx -t`, reload nginxu, smoke test) už běží nový kontejner a platí tento postup.

## 9. Nasazení větve „firmy a role“ (jednorázové, z jednoho uživatele na víc firem)

Tohle nasazení mění schéma tak, že **stará verze aplikace na něm nepojede**. Migrace
`20261109120000_organizace` ruší sloupec `Entry.userId` a přesouvá nastavení z uživatele na firmu.
Návod „vrať se na předchozí commit“, který `deploy-dohazka.sh` vypíše při selhání smoke testu,
tady **neplatí**: `git reset` vrátí kód, ne databázi. Návrat zpět znamená **obnovu z dumpu**.

### Před nasazením

**Pořadí prvních dvou kroků je důležité.** Nejdřív se zastaví aplikace, teprve pak se dumpuje.
Opačně by se zápis, který uživatel udělá mezi dumpem a zastavením, do dumpu nedostal — a při
obnově by se tiše ztratil, i když by dump vypadal v pořádku.

1. **Zapiš si, odkud se vracíš, a zastav aplikaci.** `deploy-dohazka.sh` v dalším kroku
   přepíše `GIT_COMMIT` v `dohazka.env` i tag image `dohazka-dohazka:latest`, takže potom už
   předchozí verzi nedohledáš:

   ```bash
   git -C /opt/jede/dohazka-src rev-parse HEAD                      # zapiš si hash
   grep GIT_COMMIT /opt/jede/dohazka.env                            # zapiš si i tohle
   docker tag dohazka-dohazka:latest dohazka-dohazka:pred-firmami    # starý image pod vlastním jménem
   ```

   Pak aplikaci zastav, ať do ní nikdo nepíše během dumpu ani migrace:

   ```bash
   docker compose -f /opt/jede/dohazka-src/dohazka/deploy/docker-compose.yml --env-file /opt/jede/dohazka.env stop dohazka
   ```

   Od téhle chvíle je web mimo provoz, a bude dokud `deploy-dohazka.sh` nevymění kontejner —
   včetně buildu image, který na 4 GB RAM trvá minuty. Dělej to tedy ve chvíli, kdy uživatel
   aplikaci nepotřebuje, a dej mu vědět.
2. **Svěží `pg_dump`.** Noční záloha nestačí (může být skoro o den stará a na serveru je živý
   uživatel):

   ```bash
   PGU=$(docker exec jede-db-1 printenv POSTGRES_USER)
   test -n "$PGU" && echo "uzivatel-OK: $PGU"
   docker exec jede-db-1 pg_dump -Fc -U "$PGU" -d dohazka > /root/dohazka-pred-firmami.dump      && echo dump-dobehl
   chmod 600 /root/dohazka-pred-firmami.dump
   test "$(stat -c %s /root/dohazka-pred-firmami.dump)" -gt 1024 && echo velikost-OK
   docker exec -i jede-db-1 pg_restore --list < /root/dohazka-pred-firmami.dump > /dev/null && echo dump-cte-se
   ```

   `dump-dobehl` tam je proto, že `>` vyrobí soubor i pro `pg_dump`, který spadl v půlce —
   a takový soubor `--list` i kontrola velikosti můžou projít.

   **Zapiš si teď tahle čísla** (na papír nebo do zprávy, ne do souboru na serveru, který
   budeš za chvíli přepisovat). Po migraci už polovina těch sloupců v databázi nebude:

   ```bash
   docker exec jede-db-1 psql -U "$PGU" -d dohazka -c      'SELECT count(*) AS zaznamu, coalesce(sum(hours),0) AS hodin FROM "Entry"'
   docker exec jede-db-1 psql -U "$PGU" -d dohazka -c      'SELECT id, email, "createdAt", "periodStartDay", "remindHour", "tracksFrom" FROM "User" ORDER BY "createdAt", id'
   ```

   Druhý výpis si přečti pozorně: migrace dá roli **správce firmy a nastavení období**
   tomu uživateli, který je v tom řazení **první**. Je-li tam víc než jeden účet a první
   není ten živý, **nepokračuj** — migrace by nastavení ostatních účtů zahodila a správcem
   by se stal někdo jiný. Po migraci tyhle sloupce na `User` už nejsou, takže tenhle výpis
   je jediný záznam vedle dumpu.

   Čekej `uzivatel-OK`, `dump-dobehl`, `velikost-OK` a `dump-cte-se`.
   Chybí-li cokoli, dump je nepoužitelný: **nepokračuj**. Že se superuživatel postgresu dá
   zjistit přes `printenv POSTGRES_USER`, je předpoklad (viz kapitola 3) — vyjde-li `PGU`
   prázdné, najdi uživatele v compose souboru stacku landingu a doplň ho ručně.
   `chmod 600` tam je proto, že dump obsahuje osobní údaje; po ověřeném nasazení ho smaž
   (`shred -u`).
3. V `/opt/jede/dohazka.env` doplň `RESEND_API_KEY` a případně `APP_URL` (kapitola 3).
   **Bez `RESEND_API_KEY` se obnova hesla tiše neodešle**, i když obrazovka napíše, že odkaz
   byl poslán — a zamčený člověk nemá jak dovnitř. Nepřeskakuj to.
4. **Nahraj nový vhost** (blok `/pozvanka/` s `access_log off`, kapitola 4). Klon v
   `/opt/jede/dohazka-src` je ale ještě na starém commitu, nový soubor v něm **není**;
   `deploy-dohazka.sh` ho stáhne teprve při nasazení. Vezmi ho proto přímo z originu, aniž
   bys klonu hýbal pracovním stromem:

   ```bash
   git -C /opt/jede/dohazka-src fetch origin
   git -C /opt/jede/dohazka-src show origin/master:dohazka/deploy/nginx-dohazka.jede.online.conf > /tmp/dohazka-vhost-novy.conf
   diff /etc/nginx/sites-available/dohazka.jede.online /tmp/dohazka-vhost-novy.conf
   ```

   (Je-li kód ještě na větvi, místo `origin/master` použij `origin/<větev>`.) `diff` si
   **přečti**: kromě bloku `/pozvanka/` nesmí ukázat nic, co bys tím přepsáním ztratil
   (třeba dočasně zakomentovaný blok 443 z vystavování certifikátu). Teprve pak:

   ```bash
   cp /tmp/dohazka-vhost-novy.conf /etc/nginx/sites-available/dohazka.jede.online
   nginx -t && systemctl reload nginx
   ```

   a ověř to kontrolou z kapitoly 4 (včetně kontrolního požadavku). **Dokud tohle neproběhne,
   neposílej žádnou pozvánku ani obnovu hesla** — token by se uložil do access logu.

### Nasazení a co migrace udělá se živými daty

Spusť `deploy-dohazka.sh` (kapitola 5). **Je-li kód ještě na větvi, spusť ho s `BRANCH=`**
(`BRANCH=claude/dohazka-organizace /opt/jede/.../deploy-dohazka.sh`) — výchozí je `master`, a bez
toho by skript klon srovnal na starý kód a „úspěšně“ nasadil to, co tam bylo. Aplikace je od
kroku 1 zastavená, takže po celou dobu buildu (na 4 GB RAM minuty) je web mimo provoz.

`prisma migrate deploy` pouští **každý migrační soubor** v jedné transakci: selže-li cokoli
uvnitř souboru, vrátí se ten soubor celý, databáze zůstane tak, jak byla, a kontejner se
nevymění. Soubory jsou tu ale **dva** (`20261109120000_organizace`
a `20261109140000_heslo_nastavil_majitel`), takže teoreticky může první projít a druhý ne.
Pravděpodobnost je malá — druhý je jediné `ADD COLUMN ... DEFAULT false` — ale stane-li se to,
je databáze **už na novém schématu** a rada „spusť starý kontejner na nezměněné databázi“
z „Když něco selže“ **neplatí**. Poznáš to tak, že výpis mluví o druhé migraci, ne o první:
pak jdi na obnovu z dumpu, nebo (lépe) chybu druhé migrace oprav a `migrate deploy` zopakuj.

- Vznikne firma `org_default` („Výchozí firma“), která **převezme nastavení stávajícího
  uživatele** (začátek období, hodina připomínky), takže se mu výkaz tiše nepřepíše.
- Každý dosavadní uživatel dostane členství v této firmě a všechny jeho záznamy se k němu připojí.
  Stávající (jediný) uživatel se stane **správcem firmy** (`OWNER`), jinak by přišel o přístup do
  nastavení. Super adminem se **nestává**, to je ruční krok níže.
- **Všechny účty, které vznikly před touto větví, mají `passwordSetByOwner = false`.** Je to
  úmyslné (fail-closed): heslo vygenerované strojem zná i ten, kdo účet zakládal, proto se při
  připojení takového účtu do další firmy **přepíše**. Nikoho to nemá překvapit. Jakmile si člověk
  heslo nastaví sám (pozvánka, obnova hesla), příznak se přepne a heslo se už nepřepisuje.

Ověř (`PGU` se v novém terminálu musí nastavit znovu, jinak `psql -U ""` spadne):

```bash
PGU=$(docker exec jede-db-1 printenv POSTGRES_USER)
docker exec jede-db-1 psql -U "$PGU" -d dohazka -c \
  'SELECT (SELECT count(*) FROM "Entry") AS zaznamu, (SELECT coalesce(sum(hours),0) FROM "Entry") AS hodin,
          (SELECT count(*) FROM "Membership") AS clenstvi, (SELECT count(*) FROM "Organization") AS firem'
docker exec jede-db-1 psql -U "$PGU" -d dohazka -c \
  'SELECT m.role, m.active, m."tracksFrom", o."periodStartDay", o."remindHour"
     FROM "Membership" m JOIN "Organization" o ON o.id = m."orgId"'
```

`zaznamu` i `hodin` musí být **shodné** s tím, co sis zapsal před migrací — hodiny proto, že
samotný počet řádků by neodhalil přepsané hodnoty. `clenstvi` = počet dosavadních uživatelů,
`firem` = `1`. Druhý výpis musí ukázat roli `OWNER`, `active = t` a `tracksFrom`,
`periodStartDay` i `remindHour` **beze změny** proti tomu, co měl uživatel předtím.

**Pozor na jednu věc, která nejde obejít:** `deploy-dohazka.sh` kontejner vyměnil a nginx
reloadnul, takže v tuhle chvíli **aplikace už je z internetu dostupná** — tahle kontrola běží
na živém webu, ne před jeho spuštěním. Kdyby uživatel právě teď zapsal nový den, čísla nebudou
souhlasit, i když je všechno v pořádku. Proto mu **předem řekni, ať aplikaci neotvírá, dokud
se neozveš**, a kontrolu udělej hned. Nesedí-li čísla, nejdřív se ho zeptej, jestli zapisoval —
teprve potom uvažuj o obnově z dumpu, protože ta zahodí všechno, co od nasazení vzniklo.

Přihlas se jako stávající uživatel: musíš vidět svůj měsíc se všemi dosavadními záznamy
a v navigaci Výkazy, Lidé, Nastavení firmy.

**Řekni uživateli, ať aplikaci na telefonu jednou zavře a otevře znovu.** Stránka dne teď
posílá s každým zápisem i to, pro kterou firmu se vykreslila — stránka, která zůstala
otevřená z doby před nasazením, to pole nemá a první uložení odmítne hláškou
„Obnov stránku a zkus to znovu." Je to schválně (fail-closed), ale bez varování to vypadá
jako porucha. Nainstalovaná aplikace na ploše se po zavření a otevření načte celá znovu.

**Pak přejmenuj firmu.** Migrace jí dala jméno „Výchozí firma“ a to jméno jde do hlavičky
výkazu i do názvu exportovaného souboru. V **Nastavení firmy** přepiš „Název ve výkazu“ na to,
co má být na dokumentu pro mzdy, a stáhni si jeden export na kontrolu.

### První super admin

Živý účet má heslo vygenerované strojem v `/root/dohazka-ucet.txt`. **Udělením `--super-admin`
si příkaz vynutí `--reset-password`, takže heslo v tom souboru přestane platit:**

```bash
cd /opt/jede/dohazka-src/dohazka/deploy
docker compose -f docker-compose.yml --env-file /opt/jede/dohazka.env --profile tools \
  run --rm dohazka-migrate npm run user:add -- --email jeho@email.cz --super-admin --reset-password
```

Čekej výpis `přepsáno heslo`, řádek `Heslo (zobrazeno jen teď …)` a `nastaven super admin`.
**Nové heslo se vypíše jen jednou**: zapiš ho hned a předej bezpečnou cestou. Pak
`shred -u /root/dohazka-ucet.txt`, protože je v něm už neplatné heslo. Všechna stará přihlášení
toho účtu skončila, uživatel se musí přihlásit znovu. Hláška o `--reset-password` znamená, že ses
přepínač zapomněl dopsat. Po přihlášení musí být v navigaci odkaz **Firmy**; nevidíš-li ho,
odhlas se a přihlas znovu.

### Když něco selže

- **Skript skončil jakoukoli hláškou `STOP:` před výměnou kontejneru** — selhal build (málo
  RAM nebo chybějící swap), neprošla migrační brána, nebo `STOP: migrace neprošly`: databáze je
  beze změny (transakce), ale aplikaci jsi v kroku 1 **ručně zastavil**, takže web je pořád
  mimo provoz a sám se nerozjede. Tohle je ten případ, kdy hláška skriptu „běžící verze zůstává
  nasazená" **neplatí** — žádná neběží. Vrať provoz na starou verzi:

  ```bash
  docker compose -f /opt/jede/dohazka-src/dohazka/deploy/docker-compose.yml --env-file /opt/jede/dohazka.env start dohazka
  curl -s http://127.0.0.1:3600/api/health
  ```

  (spustí původní, nevyměněný kontejner na nezměněné databázi). Teprve pak řeš příčinu
  a spusť skript znovu.
- **Migrace prošla, ale smoke test nebo ruční kontrola ukázaly chybu:** návrat na starý commit
  samotný **nepomůže**. Rozhodni mezi opravou dopředu (nový commit, `deploy-dohazka.sh`) a
  **obnovou z dumpu**. Záznamy zapsané od spuštění nové verze se obnovou **ztratí**.

  ```bash
  docker compose -f /opt/jede/dohazka-src/dohazka/deploy/docker-compose.yml --env-file /opt/jede/dohazka.env stop dohazka
  PGU=$(docker exec jede-db-1 printenv POSTGRES_USER)
  docker exec jede-db-1 psql -U "$PGU" -d postgres -c 'ALTER DATABASE dohazka RENAME TO dohazka_pred_obnovou'
  docker exec jede-db-1 sh -c 'createdb -U "$POSTGRES_USER" -O dohazka dohazka'
  docker exec -i jede-db-1 sh -c 'pg_restore --exit-on-error --no-owner --role=dohazka -U "$POSTGRES_USER" -d dohazka' < /root/dohazka-pred-firmami.dump
  docker exec jede-db-1 psql -U "$PGU" -d dohazka -c 'SELECT count(*) AS zaznamu, coalesce(sum(hours),0) AS hodin FROM "Entry"'
  ```

  **Proč přejmenování a ne `dropdb`:** dump byl ověřený jen `--list`, obnova z něj na tomhle
  serveru nikdy neběžela, a migrovaná databáze je jediné místo, kde jsou záznamy zapsané
  po nasazení. Kdyby `dropdb` smazal a `pg_restore` pak selhal, nezůstane nic. Takhle stará
  databáze pořád existuje pod jménem `dohazka_pred_obnovou`; zahoď ji (`dropdb`) teprve tehdy,
  až je obnovená databáze ověřená a web na ní běží.

  `pg_restore` **nesmí nic vypsat** a poslední příkaz musí vrátit přesně ta čísla, která sis
  zapsal před migrací. Vypíše-li `pg_restore` chybu, `--exit-on-error` ho zastaví na prvním
  problému — přečti ji, než cokoli dalšího uděláš; podruhé restore nepouštěj do napůl obnovené
  databáze, nejdřív ji zahoď a vyrob znovu (`dropdb dohazka && createdb -O dohazka dohazka`).
  Selže-li `ALTER DATABASE` hláškou, že je databáze používaná, aplikace nebyla zastavená:
  zastav ji a opakuj.

  **Ani tento postup nikdy neběžel na skutečném serveru.** Čti výstup každého příkazu.

  Pak vrať i kód a image na předchozí commit — podle hashe, který sis zapsal v kroku 1
  („Zapiš si, odkud se vracíš“), nebo podle příkazů, které `deploy-dohazka.sh` vypsal při
  selhání smoke testu: `reset --hard <hash>`, `build dohazka`, oprava `GIT_COMMIT`
  v `dohazka.env` a `up -d --force-recreate dohazka`. Starý image máš pod jménem
  `dohazka-dohazka:pred-firmami`, takže se nemusí buildovat znovu. Ověř
  `curl -s http://127.0.0.1:3600/api/health` a přihlášení.
- **Neodešel e-mail:** viz kapitola 5, bod 5. Pozvánka v aplikaci existuje a správce umí odkaz předat ručně.
- Dump z kroku „Před nasazením“ nemaž, dokud nové schéma aspoň týden běží bez potíží.

## Úklid disku

Skript nemaže Docker build cache (globální `docker builder prune` by mazal i cizí projekty).
V repu je ověřitelné jen tolik, že `pokemon/deploy/backup-pokemon.sh` obsahuje `docker builder prune` a `pokemon-daily.timer` je nastaven na 03:05. Jestli je ten timer na serveru opravdu zapnutý, z repa nevidíme — ověř `systemctl list-timers`. Občas zkontroluj `docker system df`.

## Další nasazení

Stačí `deploy-dohazka.sh` (po sloučení do `master`). Při selhání skript skončí hláškou
`STOP: …`; do kroku výměny kontejneru běží původní verze dál.
