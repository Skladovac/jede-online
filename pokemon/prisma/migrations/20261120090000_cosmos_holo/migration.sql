-- AlterEnum
ALTER TYPE "Variant" ADD VALUE 'COSMOS';

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "hasCosmos" BOOLEAN NOT NULL DEFAULT false;
