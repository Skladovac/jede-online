-- Jednorázově na serveru: docker exec -i jede-db-1 psql -U <POSTGRES_USER> -d postgres < init-db.sql
-- Heslo nahraď před spuštěním (a stejné dej do /opt/jede/vasirm.env).
CREATE USER vasirm WITH PASSWORD 'ZMEN_HESLO';
CREATE DATABASE vasirm OWNER vasirm ENCODING 'UTF8' TEMPLATE template0;
