#!/usr/bin/env bash
# Denní ověřená záloha databáze vasirm + kopie nahraných médií (fotky/videa).
# Spouští vasirm-daily.timer ve 03:15. Vzor: pokemon/deploy/backup-pokemon.sh
set -euo pipefail

BACKUP_DIR=/opt/jede/backups/vasirm-daily
MEDIA_SRC=/opt/jede/vasirm-media/
MEDIA_COPY=/opt/jede/backups/vasirm-media
DB_CONTAINER=jede-db-1
DB_NAME=vasirm
KEEP_DAYS=30
STAMP=$(date -u +%Y%m%d-%H%M%S)
FINAL="$BACKUP_DIR/vasirm-$STAMP.dump"
TEMP="$BACKUP_DIR/.vasirm-$STAMP.dump.tmp"

mkdir -p "$BACKUP_DIR" "$MEDIA_COPY"
chmod 700 "$BACKUP_DIR"
trap 'rm -f -- "$TEMP"' EXIT

docker exec "$DB_CONTAINER" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$1"' sh "$DB_NAME" > "$TEMP"
test "$(stat -c %s "$TEMP")" -gt 1024
docker exec -i "$DB_CONTAINER" pg_restore --list < "$TEMP" >/dev/null
mv -- "$TEMP" "$FINAL"
chmod 600 "$FINAL"

# Každou neděli skutečná obnova do dočasné databáze — záloha, kterou nejde obnovit, není záloha.
if [[ $(date +%u) == 7 ]]; then
  docker exec "$DB_CONTAINER" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" vasirm_restore_check && createdb -U "$POSTGRES_USER" vasirm_restore_check'
  docker exec -i "$DB_CONTAINER" sh -c 'pg_restore --exit-on-error -U "$POSTGRES_USER" -d vasirm_restore_check' < "$FINAL"
  docker exec "$DB_CONTAINER" sh -c 'psql -U "$POSTGRES_USER" -d vasirm_restore_check -Atqc "SELECT count(*) FROM \"Listing\""' | grep -Eq '^[0-9]+$'
  docker exec "$DB_CONTAINER" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" vasirm_restore_check'
  echo "Vasirm restore check OK"
fi

# Média: zrcadlo (smazané fotky zmizí i tady — starší stav drží Hetzner Backups celého serveru).
rsync -a --delete "$MEDIA_SRC" "$MEDIA_COPY/"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'vasirm-*.dump' -mtime +"$KEEP_DAYS" -delete
printf 'Vasirm backup verified: %s (%s bytes), media %s\n' "$FINAL" "$(stat -c %s "$FINAL")" "$(du -sh "$MEDIA_COPY" | cut -f1)"
