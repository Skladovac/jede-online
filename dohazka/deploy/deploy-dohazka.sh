#!/usr/bin/env bash
# Nasazení dohazka.jede.online na vlastní server.
# Na serveru: /opt/jede/dohazka-src/dohazka/deploy/deploy-dohazka.sh   Spouští se ručně přes SSH.
# Pojistky níže nezjednodušuj.
set -euo pipefail

ROOT=/opt/jede
SRC=$ROOT/dohazka-src            # vlastní klon repa jede-online
APP=$SRC/dohazka
ENVF=$ROOT/dohazka.env
BRANCH=${BRANCH:-master}
HEALTH=http://127.0.0.1:3500/api/health

log()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mSTOP: %s\033[0m\n' "$*" >&2; exit 1; }

# Pojistka: kontrola IP serveru.
[[ "$(hostname -I | awk '{print $1}')" == 178.104.231.220 ]] || fail "špatný server."
[[ -f $ENVF ]] || fail "$ENVF chybí. Vyplň podle deploy/.env.example."

dc() { docker compose -f "$APP/deploy/docker-compose.yml" --env-file "$ENVF" "$@"; }

# Pojistka: hard reset na origin/$BRANCH.
log "1/7  Hard reset na origin/$BRANCH"
# NE git pull. ⛔ Nikdy git clean.
PREV=$(git -C "$SRC" rev-parse HEAD)   # pro návod na návrat, kdyby spadl smoke test
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

# Pojistka: build gate před výměnou kontejneru + přestavba i migračního image.
log "3/7  Build gate — PŘED výměnou kontejneru"
# I migrační image! Je to samostatná image a bez přestavby by migrační brána
# viděla staré prisma/migrations a nové migrace tiše přeskočila.
dc --profile tools build dohazka dohazka-migrate || fail "build spadl. Běžící verze zůstává nasazená."

# Pojistka: migrační brána na drift.
# Hledá anglická hlášení Prisma 5; po přechodu na Prisma 6 ověř, že se znění nezměnilo.
# -T: bez TTY (ssh host skript, cron) by `run` selhal a `|| true` by zamaskoval hlášku
# o TTY jako "stav migrací" — brána by pak prošla, aniž by cokoli zkontrolovala.
log "4/7  Migrační brána"
STATUS=$(dc --profile tools run -T --rm dohazka-migrate 2>&1 || true)
echo "$STATUS"
if grep -qiE 'missing from the local migrations directory|drift detected' <<<"$STATUS"; then
  fail "databáze zná migrace, které tahle větev nemá."
fi

# Pojistka: prisma migrate deploy; selže-li, kontejner se nevymění.
log "5/7  prisma migrate deploy"
dc --profile tools run -T --rm dohazka-migrate npx prisma migrate deploy \
  || fail "migrace neprošly. Kontejner NEVYMĚNĚN."

log "6/7  Výměna kontejneru + reload nginx"
dc up -d --force-recreate dohazka
# Deploy nginx konfiguraci nemění, takže jde jen o zdvořilostní reload. Reload (ne restart) nikdy
# neshodí ostatní weby: když selže, běžící master zůstane. Brána nginx -t je navíc.
nginx -t || fail "nginx -t neprošel. Nginx NErestartován, oprav konfiguraci."
systemctl reload nginx

# Po výměně kontejneru už není automatický návrat — rozhoduje člověk. Skript jen vypíše postup.
smoke_fail() {
  printf '
[1;31mSTOP: %s[0m
' "$*" >&2
  cat >&2 <<HINT

Nová verze už běží a je rozbitá. Návrat na předchozí commit ($PREV):
  git -C $SRC reset --hard $PREV
  docker compose -f $APP/deploy/docker-compose.yml --env-file $ENVF build dohazka
  sed -i "s/^GIT_COMMIT=.*/GIT_COMMIT=${PREV:0:7}/" $ENVF
  docker compose -f $APP/deploy/docker-compose.yml --env-file $ENVF up -d --force-recreate dohazka
Migrace databáze se NEVRACEJÍ — ověř, že stará verze zvládne nové schéma.
HINT
  exit 1
}

# Pojistka: smoke test reálného endpointu, ověří DB i běžící commit.
log "7/7  Smoke test reálného endpointu (sahá do DB)"
BODY=""
for i in $(seq 1 30); do
  if BODY=$(curl -fsS --max-time 5 "$HEALTH" 2>/dev/null); then break; fi
  [[ $i -eq 30 ]] && smoke_fail "aplikace neodpověděla 200 na $HEALTH po 60 s."
  sleep 2
done
echo "$BODY"
grep -q '"db":"up"'              <<<"$BODY" || smoke_fail "aplikace běží, ale nesahá do databáze."
grep -q "\"commit\":\"$COMMIT\"" <<<"$BODY" || smoke_fail "běží jiná verze než $COMMIT."

printf '\n\033[1;32mNASAZENO: %s\033[0m\n' "$COMMIT"
