-- Jednorázově na serveru: docker exec -i jede-db-1 psql -U <POSTGRES_USER> -d postgres < init-db.sql
-- Heslo nahraď před spuštěním (a stejné dej do /opt/jede/pokemon.env).
CREATE USER pokemon WITH PASSWORD 'ZMEN_HESLO';
CREATE DATABASE pokemon OWNER pokemon;
