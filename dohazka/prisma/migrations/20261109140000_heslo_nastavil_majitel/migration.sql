-- Heslo si nastavil sam majitel uctu (pozvanka / obnova), ne spravce firmy.
-- Stavajici radky: true (hesla si lide nastavili sami nebo je zna jen majitel systemu).
ALTER TABLE "User" ADD COLUMN "passwordSetByOwner" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "passwordSetByOwner" = true;
