-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('BOOSTER', 'DISPLAY', 'ETB', 'TIN', 'BLISTER', 'BOX_SET', 'THEME_DECK', 'TRAINER_KIT', 'COIN', 'OTHER');

-- AlterTable
ALTER TABLE "TradeRequestItem" ADD COLUMN     "productId" INTEGER,
ADD COLUMN     "productItemId" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL,
    "game" TEXT NOT NULL DEFAULT 'pokemon',
    "name" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "cmExpansionId" INTEGER NOT NULL,
    "setId" TEXT,
    "imageUrl" TEXT,
    "imageCheckedAt" TIMESTAMP(3),
    "priceEur" DECIMAL(10,2),
    "priceUpdatedAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "spareQty" INTEGER NOT NULL DEFAULT 0,
    "offerType" "OfferType",
    "priceCzk" INTEGER,
    "note" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductWant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductWant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_setId_idx" ON "Product"("setId");

-- CreateIndex
CREATE INDEX "Product_kind_idx" ON "Product"("kind");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "ProductItem_productId_spareQty_idx" ON "ProductItem"("productId", "spareQty");

-- CreateIndex
CREATE UNIQUE INDEX "ProductItem_userId_productId_language_key" ON "ProductItem"("userId", "productId", "language");

-- CreateIndex
CREATE INDEX "ProductWant_productId_idx" ON "ProductWant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductWant_userId_productId_key" ON "ProductWant"("userId", "productId");

-- CreateIndex
CREATE INDEX "TradeRequestItem_productItemId_idx" ON "TradeRequestItem"("productItemId");

-- AddForeignKey
ALTER TABLE "TradeRequestItem" ADD CONSTRAINT "TradeRequestItem_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductItem" ADD CONSTRAINT "ProductItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductItem" ADD CONSTRAINT "ProductItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductWant" ADD CONSTRAINT "ProductWant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductWant" ADD CONSTRAINT "ProductWant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

