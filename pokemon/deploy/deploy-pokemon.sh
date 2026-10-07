#!/usr/bin/env bash
# Nasazení pokemon.jede.online na vlastní server.
# Na serveru: /opt/jede/pokemon-src/pokemon/deploy/deploy-pokemon.sh   Spouští se ručně přes SSH.
# Pojistky z INFRA-PODKLAD-Z-ELASRY.md — nezjednodušuj je.
set -euo pipefail

ROOT=/opt/jede
SRC=$ROOT/pokemon-src            # klon repa jede-online
APP=$SRC/pokemon
ENVF=$ROOT/pokemon.env
BRANCH=${BRANCH:-master}
HEALTH=http://127.0.0.1:3400/api/health

log()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mSTOP: %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(hostname -I | awk '{print $1}')" == 178.104.231.220 ]] || fail "špatný server."
[[ -f $ENVF ]] || fail "$ENVF chybí. Vyplň podle deploy/.env.example."

dc() { docker compose -f "$APP/deploy/docker-compose.yml" --env-file "$ENVF" "$@"; }

log "1/7  Hard reset na origin/$BRANCH"
# NE git pull. ⛔ Nikdy git clean.
git -C "$SRC" fetch --prune origin
git -C "$SRC" reset --hard "origin/$BRANCH"
COMMIT=$(git -C "$SRC" rev-parse --short HEAD)
echo "commit: $COMMIT  ($(git -C "$SRC" log -1 --format=%s))"

log "2/7  GIT_COMMIT do env"
if grep -q '^GIT_COMMIT=' "$ENVF"; then
  sed -i "s/^GIT_COMMIT=.*/GIT_COMMIT=$COMMIT/" "$ENVF"
else
  echo "GIT_COMMIT=$COMMIT" >> "$ENVF"
fi

log "3/7  Build gate — PŘED výměnou kontejneru"
# I migrační image! Je to samostatná image a bez přestavby by migrační brána
# viděla staré prisma/migrations a nové migrace tiše přeskočila.
dc --profile tools build pokemon pokemon-migrate || fail "build spadl. Běžící verze zůstává nasazená."

log "4/7  Migrační brána"
STATUS=$(dc --profile tools run --rm pokemon-migrate 2>&1 || true)
echo "$STATUS"
if grep -qiE 'missing from the local migrations directory|drift detected' <<<"$STATUS"; then
  fail "databáze zná migrace, které tahle větev nemá."
fi

log "5/7  prisma migrate deploy"
dc --profile tools run --rm pokemon-migrate npx prisma migrate deploy \
  || fail "migrace neprošly. Kontejner NEVYMĚNĚN."

log "6/7  Výměna kontejneru + restart nginx"
dc up -d --force-recreate pokemon
systemctl restart nginx   # restart, ne reload — nginx drží IP upstreamu

log "7/7  Smoke test reálného endpointu (sahá do DB)"
BODY=""
for i in $(seq 1 30); do
  if BODY=$(curl -fsS --max-time 5 "$HEALTH" 2>/dev/null); then break; fi
  [[ $i -eq 30 ]] && fail "aplikace neodpověděla 200 na $HEALTH po 60 s."
  sleep 2
done
echo "$BODY"
grep -q '"db":"up"'              <<<"$BODY" || fail "aplikace běží, ale nesahá do databáze."
grep -q "\"commit\":\"$COMMIT\"" <<<"$BODY" || fail "běží jiná verze než $COMMIT."

printf '\n\033[1;32mNASAZENO: %s\033[0m\n' "$COMMIT"
