-- Typ Pokémona u karty (Fire, Water…).
ALTER TABLE "Card" ADD COLUMN "types" TEXT[] DEFAULT ARRAY[]::TEXT[];
