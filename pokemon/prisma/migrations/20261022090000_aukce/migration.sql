-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "startPriceCzk" INTEGER,
    "note" VARCHAR(500),
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionItem" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "cardId" TEXT,
    "productId" INTEGER,

    CONSTRAINT "AuctionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Auction_endsAt_idx" ON "Auction"("endsAt");

-- CreateIndex
CREATE INDEX "Auction_userId_endsAt_idx" ON "Auction"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "AuctionItem_auctionId_idx" ON "AuctionItem"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionItem_cardId_idx" ON "AuctionItem"("cardId");

-- CreateIndex
CREATE INDEX "AuctionItem_productId_idx" ON "AuctionItem"("productId");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItem" ADD CONSTRAINT "AuctionItem_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItem" ADD CONSTRAINT "AuctionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItem" ADD CONSTRAINT "AuctionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
