# deploy/ — infrastruktura jede.online na vlastním serveru

Cílový stroj: **Hetzner CX23, `178.104.231.220`**, Nuremberg.
⛔ Nikde jinde tyhle skripty nespouštěj. `bootstrap-server.sh` si IP sám ověřuje.

Rozsah přesunu a dělbu práce s Codexem drží `DEPLOY-HANDOVER.md` v kořeni
pracovní složky. `casinovsetin.cz` ani `kasinovsetin.cz` se nestěhují — zůstávají
na WEDOSu.

## Rozvržení na serveru

```
/opt/jede/
  .env                     # tajemství, mimo git (vzor: deploy/.env.example)
  backups/                 # chmod 700, netrackované — NIKDY sem `git clean`
  landing/                 # git clone github.com/Skladovac/jede-online
    deploy/                # tenhle adresář, aktualizuje se resetem
      docker-compose.yml
      deploy-landing.sh
/etc/nginx/sites-available/*.conf   # z deploy/nginx/, nginx běží na hostu
/var/www/kasinovsetin/              # statika kasinovsetin.jede.online
/var/www/certbot/                   # ACME challenge
```

Compose i deploy skript **žijí v repu**, ne volně na serveru — po
`git reset --hard` se aktualizují spolu s kódem a nemůže zůstat viset stará kopie.

## Porty (jen `127.0.0.1`)

| služba | port | doména | vlastník |
|---|---|---|---|
| landing | `3200` | `jede.online` | Claude |
| CVMS | `3100` | `kasino.jede.online` | Codex |
| PostgreSQL | `5432` | — | sdílené |

Ven jde jen nginx na 80/443 a SSH na 22.

## Postup

```bash
# 1) jednorázově, jako root na serveru
./bootstrap-server.sh              # swap, ufw, docker, nginx, certbot, adresáře

# 2) ručně
#    Hetzner → Backups → Enable, a za pár dní OVĚŘIT, že záloha vznikla
git clone https://github.com/Skladovac/jede-online.git /opt/jede/landing
cp /opt/jede/landing/deploy/.env.example /opt/jede/.env && vim /opt/jede/.env
cp /opt/jede/landing/deploy/nginx/*.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/jede.online.conf /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 3) při každém nasazení
/opt/jede/landing/deploy/deploy-landing.sh
```

TLS až **po** přepnutí DNS — certbot potřebuje, aby doména mířila sem:

```bash
certbot --nginx -d jede.online -d www.jede.online
```

## Co skript hlídá

Pojistky z `INFRA-PODKLAD-Z-ELASRY.md`, každá vznikla po skutečném výpadku:

1. hard reset na origin, ne `git pull`
2. build gate **před** výměnou kontejneru
3. migrační brána — DB nesmí znát migrace, které větev nemá
4. `systemctl restart nginx`, ne reload
5. smoke test `/api/health`, který sahá do DB — ne prázdné 200
6. `GIT_COMMIT` do `.env`, ověřený proti odpovědi health endpointu

## Pasti

- **`chmod +x` na serveru nedrží** — mode se vrací z gitu při každém resetu.
  Skripty tu proto mají executable bit nastavený v gitu.
- **Proměnná mimo `docker-compose.yml` do kontejneru nedojde**, i když je v `.env`.
- **„Zapnuto" ≠ „funguje"** — Hetzner Backups i certbot ověřuj výsledkem, ne nastavením.
- **Disk má 40 GB.** Musí se do něj vejít běžící DB + záloha + prostor pro obnovu.
  Pokud produkční DB CVMS přesáhne ~10 GB, je potřeba Hetzner Volume.
