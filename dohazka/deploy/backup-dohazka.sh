#!/usr/bin/env bash
# Denní ověřená záloha databáze dohazka.
# Spouští dohazka-backup.timer ve 03:25 pražského času (pokemon má 03:05, ať se nepotkají).
set -euo pipefail

BACKUP_DIR=/opt/jede/backups/dohazka-daily
DB_CONTAINER=jede-db-1
DB_NAME=dohazka
KEEP_DAYS=14
STAMP=$(date -u +%Y%m%d-%H%M%S)
FINAL="$BACKUP_DIR/dohazka-$STAMP.dump"
TEMP="$BACKUP_DIR/.dohazka-$STAMP.dump.tmp"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
trap 'rm -f -- "$TEMP"' EXIT

docker exec "$DB_CONTAINER" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$1"' sh "$DB_NAME" > "$TEMP"
test "$(stat -c %s "$TEMP")" -gt 1024
docker exec -i "$DB_CONTAINER" pg_restore --list < "$TEMP" >/dev/null
mv -- "$TEMP" "$FINAL"
chmod 600 "$FINAL"

# Každou neděli skutečná obnova do dočasné databáze — záloha, kterou nejde obnovit, není záloha.
if [[ $(date +%u) == 7 ]]; then
  docker exec "$DB_CONTAINER" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" dohazka_restore_check && createdb -U "$POSTGRES_USER" dohazka_restore_check'
  docker exec -i "$DB_CONTAINER" sh -c 'pg_restore --exit-on-error -U "$POSTGRES_USER" -d dohazka_restore_check' < "$FINAL"
  docker exec "$DB_CONTAINER" sh -c 'psql -U "$POSTGRES_USER" -d dohazka_restore_check -Atqc "SELECT count(*) FROM \"User\""' | grep -Eq '^[0-9]+$'
  docker exec "$DB_CONTAINER" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" dohazka_restore_check'
  echo "Dohazka restore check OK"
fi

# Mazání jen denních dumpů v tomto adresáři.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'dohazka-*.dump' -mtime +"$KEEP_DAYS" -delete
printf 'Dohazka backup verified: %s (%s bytes)\n' "$FINAL" "$(stat -c %s "$FINAL")"
