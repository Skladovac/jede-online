-- AlterTable
ALTER TABLE "Rating" ALTER COLUMN "requestId" DROP NOT NULL,
ADD COLUMN "comment" VARCHAR(300),
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Rating_fromId_toId_idx" ON "Rating"("fromId", "toId");
