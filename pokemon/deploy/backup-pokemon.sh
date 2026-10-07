#!/usr/bin/env bash
# Denní ověřená záloha databáze pokemon + úklid build cache Dockeru (disk má jen 38 GB).
# Spouští pokemon-daily.timer ve 03:05 (před nočním syncem katalogu ve 03:30).
set -euo pipefail

BACKUP_DIR=/opt/jede/backups/pokemon-daily
DB_CONTAINER=jede-db-1
DB_NAME=pokemon
KEEP_DAYS=14
STAMP=$(date -u +%Y%m%d-%H%M%S)
FINAL="$BACKUP_DIR/pokemon-$STAMP.dump"
TEMP="$BACKUP_DIR/.pokemon-$STAMP.dump.tmp"

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
  docker exec "$DB_CONTAINER" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" pokemon_restore_check && createdb -U "$POSTGRES_USER" pokemon_restore_check'
  docker exec -i "$DB_CONTAINER" sh -c 'pg_restore --exit-on-error -U "$POSTGRES_USER" -d pokemon_restore_check' < "$FINAL"
  docker exec "$DB_CONTAINER" sh -c 'psql -U "$POSTGRES_USER" -d pokemon_restore_check -Atqc "SELECT count(*) FROM \"User\""' | grep -Eq '^[0-9]+$'
  docker exec "$DB_CONTAINER" sh -c 'dropdb --if-exists -U "$POSTGRES_USER" pokemon_restore_check'
  echo "Pokemon restore check OK"
fi

# Mazání jen denních dumpů v tomto adresáři.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pokemon-*.dump' -mtime +"$KEEP_DAYS" -delete
printf 'Pokemon backup verified: %s (%s bytes)\n' "$FINAL" "$(stat -c %s "$FINAL")"

# Build cache Dockeru starší než týden (každý deploy přidá stovky MB). Obrazy ani kontejnery se nemažou.
docker builder prune -f --filter until=168h >/dev/null
df -h / | awk 'NR==2 {print "Disk: " $5 " used, " $4 " free"}'
