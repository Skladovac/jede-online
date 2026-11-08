-- Jednorázově na serveru: docker exec -i jede-db-1 psql -U <POSTGRES_USER> -d postgres < init-db.sql
-- Heslo nahraď před spuštěním (a stejné dej do DOHAZKA_DATABASE_URL v /opt/jede/dohazka.env).
-- Použij jen písmena a číslice, ať se heslo v URL nemusí kódovat.
CREATE USER dohazka WITH PASSWORD 'ZMEN_HESLO';
CREATE DATABASE dohazka OWNER dohazka;
