-- Japonské sady a původní (japonské) názvy.
ALTER TABLE "CardSet" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "nameOriginal" TEXT;
ALTER TABLE "Card" ADD COLUMN "nameOriginal" TEXT;
CREATE INDEX "CardSet_language_idx" ON "CardSet"("language");
