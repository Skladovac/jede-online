#!/usr/bin/env bash
# Nasazení landingu jede.online na vlastní server.
# Na serveru: /opt/jede/landing/deploy/deploy-landing.sh   Spouští se ručně přes SSH.
#
# Každý krok je pojistka z INFRA-PODKLAD-Z-ELASRY.md. Nezjednodušuj je.
set -euo pipefail

ROOT=/opt/jede
APP=$ROOT/landing
BRANCH=${BRANCH:-master}
HEALTH=http://127.0.0.1:3200/api/health

log()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mSTOP: %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f $ROOT/.env ]] || fail "$ROOT/.env chybí. Vyplň podle deploy/.env.example."

# Compose soubor se bere Z REPA — po resetu je tedy vždy aktuální.
dc() { docker compose -f "$APP/deploy/docker-compose.yml" --env-file "$ROOT/.env" "$@"; }

log "1/7  Hard reset na origin/$BRANCH"
# NE `git pull`. Lokálně změněný soubor na serveru jednou pull odmítl a produkce
# tiše běžela na starém kódu — každá další "oprava" vypadala nasazená.
# ⛔ Nikdy `git clean` — smete i netrackované zálohy.
git -C "$APP" fetch --prune origin
git -C "$APP" reset --hard "origin/$BRANCH"
COMMIT=$(git -C "$APP" rev-parse --short HEAD)
echo "commit: $COMMIT  ($(git -C "$APP" log -1 --format=%s))"

log "2/7  GIT_COMMIT do .env"
# Ať /api/health nelže o verzi. .env je gitignorovaný, reset --hard se ho nedotkl.
if grep -q '^GIT_COMMIT=' "$ROOT/.env"; then
  sed -i "s/^GIT_COMMIT=.*/GIT_COMMIT=$COMMIT/" "$ROOT/.env"
else
  echo "GIT_COMMIT=$COMMIT" >> "$ROOT/.env"
fi

log "3/7  Build gate — PŘED výměnou kontejneru"
# Když build spadne, běžící verze zůstává nedotčená.
dc build landing || fail "build spadl. Běžící verze zůstává nasazená."

log "4/7  Migrační brána"
STATUS=$(dc --profile tools run --rm landing-migrate 2>&1 || true)
echo "$STATUS"
if grep -qiE 'missing from the local migrations directory|drift detected' <<<"$STATUS"; then
  fail "databáze zná migrace, které tahle větev nemá. Nasazoval bys kód, který o schématu neví."
fi

log "5/7  prisma migrate deploy"
dc --profile tools run --rm landing-migrate npx prisma migrate deploy \
  || fail "migrace neprošly. Kontejner NEVYMĚNĚN."

log "6/7  Výměna kontejneru + restart nginx"
dc up -d --force-recreate landing
# RESTART, ne reload — nginx si drží IP upstreamu a vracel by 502 na starou adresu.
systemctl restart nginx

log "7/7  Smoke test reálného endpointu (sahá do DB)"
BODY=""
for i in $(seq 1 30); do
  if BODY=$(curl -fsS --max-time 5 "$HEALTH" 2>/dev/null); then break; fi
  [[ $i -eq 30 ]] && fail "aplikace neodpověděla 200 na $HEALTH po 60 s."
  sleep 2
done
echo "$BODY"
grep -q '"db":"up"'              <<<"$BODY" || fail "aplikace běží, ale nesahá do databáze."
grep -q "\"commit\":\"$COMMIT\"" <<<"$BODY" || fail "běží jiná verze než $COMMIT. 'Zapnuto' != 'funguje'."

printf '\n\033[1;32mNASAZENO: %s\033[0m\n' "$COMMIT"
