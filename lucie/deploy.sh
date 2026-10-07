#!/bin/sh
# Nasazení webu na https://lucie.jede.online (statické soubory, nginx na serveru jede.online).
# Spuštění: sh deploy.sh
#
# Pojistky:
#  - build a testy musí projít, jinak se nic nenahraje
#  - kontrola identity serveru (IP) před jakoukoli změnou
#  - záloha předchozí verze, nová verze se rozbalí vedle a vymění se najednou
#  - kontrola skutečných adres po nasazení (ne jen jedné stránky)
set -eu

SERVER_IP=178.104.231.220
SERVER="root@$SERVER_IP"
KEY="$HOME/.ssh/jede_deploy"
SITE=https://lucie.jede.online

cd "$(dirname "$0")"
npm run build
npm test

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar -czf "$TMP/dist.tgz" -C dist .
scp -i "$KEY" -o BatchMode=yes "$TMP/dist.tgz" "$SERVER:/tmp/lucie-dist.tgz"

ssh -i "$KEY" -o BatchMode=yes "$SERVER" "EXPECTED_IP=$SERVER_IP sh -s" <<'REMOTE'
set -eu
[ "$(hostname -I | awk '{print $1}')" = "$EXPECTED_IP" ] || { echo "Špatný server, končím."; exit 1; }
DIR=/opt/jede/lucie
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DIR/backup"
tar -czf "$DIR/backup/public-$TS.tgz" -C "$DIR/public" .
rm -rf "$DIR/public.new" && mkdir -p "$DIR/public.new"
tar -xzf /tmp/lucie-dist.tgz -C "$DIR/public.new"
rm -f /tmp/lucie-dist.tgz "$DIR/public.new/.htaccess" "$DIR/public.new/_headers"
find "$DIR/public.new" -type d -exec chmod 755 {} +
find "$DIR/public.new" -type f -exec chmod 644 {} +
rm -rf "$DIR/public.old" && mv "$DIR/public" "$DIR/public.old" && mv "$DIR/public.new" "$DIR/public"
# ponechat posledních 10 záloh
ls -1t "$DIR"/backup/public-*.tgz 2>/dev/null | tail -n +11 | xargs -r rm -f
echo "Nasazeno, záloha public-$TS.tgz"
REMOTE

fail=0
for path in / /masaze/ /o-lucii/ /cenik/ /darkove-poukazy/ /reference/ /faq/ /kontakt/ /soukromi/ /robots.txt /sitemap.xml; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE$path")
  [ "$code" = 200 ] || { echo "CHYBA $path -> $code"; fail=1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE/neexistujici-adresa/")
[ "$code" = 404 ] || { echo "CHYBA: neexistující adresa vrací $code místo 404"; fail=1; }
css=$(curl -s --max-time 15 "$SITE/" | grep -o 'assets/style.css?v=[0-9a-f]*' | head -1)
[ -n "$css" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$SITE/$css")" = 200 ] || { echo "CHYBA: styl se nenačítá"; fail=1; }
[ "$fail" = 0 ] && echo "Kontrola ostrého webu: vše v pořádku ($SITE)" || { echo "Kontrola ostrého webu selhala. Předchozí verze je na serveru v /opt/jede/lucie/public.old"; exit 1; }
