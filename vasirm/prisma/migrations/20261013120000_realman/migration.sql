-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('MANUAL', 'REALMAN');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalUpdated" TEXT,
ADD COLUMN     "source" "ListingSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "syncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncError" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "syncPayload" JSONB,
ADD COLUMN     "syncState" TEXT NOT NULL DEFAULT 'ok',
ADD COLUMN     "videoSourceKey" TEXT;

-- AlterTable
ALTER TABLE "ListingImage" ADD COLUMN     "externalHash" TEXT;

-- CreateTable
CREATE TABLE "RealmanLog" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "listingId" TEXT,
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealmanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealmanLog_createdAt_idx" ON "RealmanLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_externalId_key" ON "Listing"("externalId");

