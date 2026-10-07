-- AlterTable
ALTER TABLE "WantItem" ADD COLUMN "buy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxPriceCzk" INTEGER,
ADD COLUMN "minCondition" "Condition",
ADD COLUMN "language" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ProductWant" ADD COLUMN "buy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxPriceCzk" INTEGER,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "WantItem_cardId_buy_idx" ON "WantItem"("cardId", "buy");
