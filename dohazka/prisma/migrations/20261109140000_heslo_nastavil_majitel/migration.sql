-- Heslo si nastavil sam majitel uctu (pozvanka / obnova), ne spravce firmy.
-- Stavajici radky zustavaji false: jejich hesla vygeneroval stroj (user-add), vlastnik si je nenastavil.
ALTER TABLE "User" ADD COLUMN "passwordSetByOwner" BOOLEAN NOT NULL DEFAULT false;
