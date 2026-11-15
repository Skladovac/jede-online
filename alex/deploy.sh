#!/bin/sh
# Nasazení Alexe (Telegram bot @AlexPraha_bot) na server jede.online v Dockeru.
# Spuštění z počítače:  sh alex/deploy.sh
#
# Pojistky:
#  - kontrola identity serveru (IP) před jakoukoli změnou
#  - nový obraz se nejdřív otestuje v dočasném kontejneru; když testy neprojdou, nic se nemění
#  - předchozí verze zůstává jako /opt/jede/alex-src.stara a obraz alex-bot:stara (návrat viz README)
#  - token a klíče (/opt/jede/alex.env) ani databáze (/opt/jede/alex-data) se nepřepisují
set -eu

SERVER_IP=178.104.231.220
SERVER="root@$SERVER_IP"

cd "$(dirname "$0")"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar -czf "$TMP/alex.tgz" --exclude=__pycache__ --exclude=.pytest_cache --exclude=.env --exclude=data .
scp -o BatchMode=yes "$TMP/alex.tgz" "$SERVER:/tmp/alex-src.tgz"

ssh -o BatchMode=yes "$SERVER" "EXPECTED_IP=$SERVER_IP sh -s" <<'REMOTE'
set -eu
[ "$(hostname -I | awk '{print $1}')" = "$EXPECTED_IP" ] || { echo "Špatný server, končím."; exit 1; }
J=/opt/jede
[ -f "$J/alex.env" ] || { echo "Chybí $J/alex.env (token a klíče), končím."; exit 1; }
mkdir -p "$J/alex-data" && chown 10001:10001 "$J/alex-data" && chmod 700 "$J/alex-data"

rm -rf "$J/alex-src.new" && mkdir "$J/alex-src.new"
tar -xzf /tmp/alex-src.tgz -C "$J/alex-src.new" && rm -f /tmp/alex-src.tgz
ln -s ../alex.env "$J/alex-src.new/.env"
chown -R root:root "$J/alex-src.new"

echo "Sestavuji obraz…"
docker build -q -t alex-bot:nova "$J/alex-src.new" >/dev/null
echo "Testy v dočasném kontejneru…"
docker run --rm -u root -e PYTHONDONTWRITEBYTECODE=1 -v "$J/alex-src.new/tests:/app/tests:ro" alex-bot:nova \
  sh -c "pip install -q --root-user-action=ignore pytest >/dev/null && python -m pytest -q -p no:cacheprovider tests" \
  || { echo "Testy neprošly, běžící verze zůstává."; rm -rf "$J/alex-src.new"; exit 1; }

if docker image inspect alex-bot:latest >/dev/null 2>&1; then docker tag alex-bot:latest alex-bot:stara; fi
docker tag alex-bot:nova alex-bot:latest
if [ -d "$J/alex-src" ]; then rm -rf "$J/alex-src.stara" && mv "$J/alex-src" "$J/alex-src.stara"; fi
mv "$J/alex-src.new" "$J/alex-src"
cd "$J/alex-src" && docker compose up -d --no-build --force-recreate
sleep 10
docker compose logs --tail 15
REMOTE
