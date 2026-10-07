-- DropForeignKey
ALTER TABLE "TradeRequestItem" DROP CONSTRAINT "TradeRequestItem_collectionItemId_fkey";

-- AlterTable
ALTER TABLE "TradeRequest" ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "TradeRequestItem" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "detail" TEXT NOT NULL,
ADD COLUMN     "fromRequester" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "offerType" "OfferType",
ADD COLUMN     "priceCzk" INTEGER,
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "collectionItemId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "TradeRequestItem_collectionItemId_idx" ON "TradeRequestItem"("collectionItemId");

-- AddForeignKey
ALTER TABLE "TradeRequestItem" ADD CONSTRAINT "TradeRequestItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

