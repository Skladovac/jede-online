-- DropIndex
DROP INDEX "CardSet_series_idx";

-- AlterTable
ALTER TABLE "CardSet" ADD COLUMN     "game" TEXT NOT NULL DEFAULT 'pokemon',
ADD COLUMN     "officialCount" INTEGER NOT NULL,
ADD COLUMN     "seriesId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "category" TEXT,
ADD COLUMN     "priceReverseEur" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "CardSet_game_releaseDate_idx" ON "CardSet"("game", "releaseDate");

-- CreateIndex
CREATE INDEX "CardSet_seriesId_idx" ON "CardSet"("seriesId");

