# DEPLOY-HANDOVER — jede.online → vlastní server

Společný dokument pro koordinaci **Claude Code** (server) a **Codex** (aplikace CVMS).
Každý pracuje na vlastní větvi. Změny v tomto souboru = předávka.

**31. 8. 2026 — ZÚŽENÍ ROZSAHU (Tomáš):** `casinovsetin.cz` i `kasinovsetin.cz`
**zůstávají na WEDOSu** a nestěhují se. Ze serveru tím padá PHP, php-fpm i MariaDB.

---

## Cílový server

| položka | hodnota |
|---|---|
| poskytovatel | Hetzner Cloud, CX23 (#159516449) |
| lokalita | Nuremberg / eu-central |
| CPU / RAM / disk | 2 vCPU / 4 GB / 40 GB local |
| IPv4 | `178.104.231.220` |
| IPv6 | `2a01:4f8:1c18:32b5::/64` |
| OS | Ubuntu 26.04 LTS (hostname `jede`) |

⛔ **Server je vyhrazený POUZE pro jede.online a jeho subdomény.**
⛔ **Na server ani repozitář Elasry nikdo nesahá.** Přebírají se jen pojistky
   z `INFRA-PODKLAD-Z-ELASRY.md`, ne cesty, jména ani přístupy.

---

## Dělba práce

| oblast | vlastník |
|---|---|
| OS, uživatelé, SSH, firewall, swap | **Claude** |
| Docker + Docker Compose runtime | **Claude** |
| nginx (reverse proxy, routing dle domény) | **Claude** |
| TLS / certbot | **Claude** |
| zálohy serveru (Hetzner Backups) | **Claude** |
| kontejner CVMS, Dockerfile, konfigurace appky | **Codex** |
| databázové migrace CVMS (Prisma) | **Codex** |
| záloha / obnova / ověření produkčních dat CVMS | **Codex** |
| landing `jede.online` (Next.js) | **Claude** |
| `kasinovsetin.jede.online` (statické HTML) | **Claude** |

**Hranice:** do `nginx/` konfigurace zasahuje pouze Claude.
Codex předá jen *hostname + host port*, na kterém jeho kontejner poslouchá.

---

## Mapa portů (jen `127.0.0.1`, nikdy ven)

| služba | host port | uvnitř kontejneru | doména | vlastník |
|---|---|---|---|---|
| CVMS | `127.0.0.1:3100` | `3000` | `kasino.jede.online` | Codex |
| landing | `127.0.0.1:3200` | `3000` | `jede.online` | Claude |
| PostgreSQL | `127.0.0.1:5432` | `5432` | — | sdílené |

Statika `kasinovsetin.jede.online` jde přímo z nginxu, bez kontejneru.
Ven jde pouze nginx na **80** a **443**. SSH na **22**.

---

## Co se stěhuje

| projekt | dnes běží na | stack | cíl |
|---|---|---|---|
| CVMS (`kasino/`) | Vercel `76.76.21.21` | Next.js + Prisma + PostgreSQL | `kasino.jede.online` |
| landing (root repa) | Vercel `216.198.79.1` | Next.js + Prisma + PostgreSQL (Neon) | `jede.online` |
| `kasinovsetin` | Vercel `76.76.21.21` | statické HTML | `kasinovsetin.jede.online` |

## Co se NEstěhuje — zůstává na WEDOSu

| projekt | dnes běží na | rozhodnutí |
|---|---|---|
| `casinovsetin.cz` | WEDOS `46.28.106.244` | zůstává, nesaháme |
| `kasinovsetin.cz` | WEDOS `46.28.106.75` | zůstává, nesaháme |

Složky `casinovsetin-cz/` a `kasinovsetin-stavba/` proto zůstávají mimo rozsah
přesunu. Neřeší se ani `db.php`, ani `.htaccess`, ani MySQL — hostuje WEDOS.

---

## Pojistky převzaté z Elasry

Zdroj: `INFRA-PODKLAD-Z-ELASRY.md`. Každá vznikla po skutečném výpadku.

1. **Hard reset na origin, ne `git pull`.** Produkce = přesná kopie originu.
   `git fetch && git reset --hard origin/<branch>`
2. **Build gate PŘED výměnou kontejneru.** Next.js: úspěšný `next build`.
   Když build spadne, běžící verze zůstává nedotčená.
3. **Migrační brána.** `prisma migrate status` — nasazovaná větev musí znát
   revizi, na které stojí databáze.
4. **Restart nginx po výměně appky**, ne reload — nginx si drží IP upstreamu.
5. **Smoke test reálného endpointu**, který sahá do DB. Ne `/health`.
6. **`GIT_COMMIT` do `.env`**, ať verze v aplikaci nelže.
7. ⛔ **Nikdy `git clean` na produkci** — smete i netrackované zálohy.
8. **Proměnná, která není v `docker-compose.yml`, do kontejneru NEDOJDE**,
   i když je v `.env`. Každou vypsat explicitně.
9. **Mount jednoho souboru drží inode.** Po `reset --hard` je nutný *restart*
   kontejneru, ne reload — jinak běží na staré konfiguraci.
10. **„Zapnuto" ≠ „funguje".** Ověřuj výsledek zvenku, ne nastavení.

---

## Postup přesunu

- [ ] 0. **Zálohy Hetzner zapnout** a po pár dnech ověřit, že záloha VZNIKLA
- [x] 1. SSH klíč na server, ověřit spojení — přes Rescue, klíč `~/.ssh/jede`
- [x] 2. Swap (4 GB) — aktivní, ověřeno `swapon --show`
- [x] 3. Firewall — ufw aktivní; zvenku ověřeno, že 5432 i 3200 jsou zavřené
- [x] 4. Docker 29.7.2 + Compose v5.5.0
- [x] 5. PostgreSQL 16 kontejner na `127.0.0.1:5432`, healthy
- [~] 6. nginx 1.28.3 běží, 3 vhosty aktivní. **TLS čeká na DNS** — certbot
       potřebuje, aby doména mířila na server
- [ ] 7. **Úplná záloha produkční DB CVMS** (Codex)
- [ ] 8. **Zkušební obnova na novém serveru** (Codex)
- [ ] 9. **Ověření dat**: účty, hodiny, fotky, výběry, provozní dny (Codex)
- [ ] 10. Nasazení CVMS přes HTTPS, test na dočasné adrese
- [x] 11. Landing nasazen (`e572403`, health `db:up`), statika servíruje 200
- [ ] 12. Finální záloha + přepnutí DNS (jen záznamy pod `jede.online`)
- [ ] 13. **Vercel běží dál jako cesta zpět**, dokud se provoz nepotvrdí

---

## Otevřené otázky

| # | otázka | na kom | stav |
|---|---|---|---|
| 1 | Velikost produkční DB CVMS včetně fotek a dokumentů | Codex | měří se v produkci |
| 2 | Verze PostgreSQL, kterou CVMS potřebuje | Codex | ověřuje |
| 3 | ~~Přesná verze OS na serveru~~ | — | ✅ Ubuntu 26.04 LTS |
| 4 | ~~Která ze složek `casinovsetin-*` je živá na doméně~~ | — | ✅ odpadá, zůstává WEDOS |
| 5 | SSH přístup — klíč `jede_deploy` na serveru není | Tomáš | **BLOKUJE krok 1** |
| 6 | Nezacommitované změny v `Features.tsx` + `HowItWorks.tsx` (96 řádků) | Tomáš | commitnout, jinak se nenasadí |
| 7 | `www.jede.online` nemá A záznam | Tomáš | doplnit, jinak certbot na `www` spadne |
| 8 | Přenos tabulky `Lead` z Neonu na lokální Postgres | Tomáš | čeká na svolení — filtr blokuje sáhnutí na Neon údaje |
| 9 | Kdy přepnout DNS `jede.online` z Vercelu na server | Tomáš | rozhodnutí |

⚠️ **Riziko k #6:** deploy dělá `git reset --hard origin/master` (pojistka 1).
Co není na originu, na server nedojede. Lokální rozdělaná práce se tiše ztratí
z produkce — a bude to vypadat, že nasazení proběhlo.

⚠️ **`kasinovsetin/` (index.html + logo.png) není v žádném gitu** — existuje
jen lokálně a na Vercelu. Na server se musí nahrát ručně přes `scp` do
`/var/www/kasinovsetin/`. Jediná kopie navíc = jediné místo selhání.

✅ **Vyřešeno 31. 8.:** `prisma/migrations/` bylo v `.gitignore`, takže migrace
nikdy neopustily tenhle počítač. Bez nich nemá `prisma migrate deploy` na serveru
co nasadit a migrační brána (pojistka 3) by neměla co kontrolovat. Odignorováno.

⚠️ **Riziko k #1:** disk má 40 GB. Do něj se musí vejít běžící databáze
+ záloha + prostor pro obnovu. Pokud produkční DB přesáhne ~10 GB,
je nutný Hetzner Volume, jinak obnova selže na plném disku.
