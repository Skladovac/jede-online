-- CreateEnum
CREATE TYPE "Country" AS ENUM ('CZ', 'SK');

-- CreateEnum
CREATE TYPE "Variant" AS ENUM ('NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('MINT', 'LIGHT_PLAYED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('TRADE', 'SELL', 'GIFT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RatingTag" AS ENUM ('FAST_SHIPPING', 'AS_DESCRIBED', 'FRIENDLY', 'SLOW', 'NOT_AS_DESCRIBED', 'NOT_SENT');

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "code" TEXT,
    "releaseDate" TIMESTAMP(3),
    "cardCount" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "symbolUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "hasNormal" BOOLEAN NOT NULL DEFAULT true,
    "hasHolo" BOOLEAN NOT NULL DEFAULT false,
    "hasReverse" BOOLEAN NOT NULL DEFAULT false,
    "hasFirstEd" BOOLEAN NOT NULL DEFAULT false,
    "priceEur" DECIMAL(10,2),
    "priceUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "nickname" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "birthMonth" INTEGER NOT NULL,
    "country" "Country" NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "parentEmail" TEXT,
    "parentConsentAt" TIMESTAMP(3),
    "parentConsentName" TEXT,
    "parentToken" TEXT,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "aukroUrl" TEXT,
    "linksApprovedAt" TIMESTAMP(3),
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "variant" "Variant" NOT NULL DEFAULT 'NORMAL',
    "condition" "Condition" NOT NULL DEFAULT 'MINT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "note" VARCHAR(30),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "spareQty" INTEGER NOT NULL DEFAULT 0,
    "offerType" "OfferType",
    "priceCzk" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WantItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "variant" "Variant",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WantItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRequest" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "fromDoneAt" TIMESTAMP(3),
    "toDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TradeRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "positive" BOOLEAN NOT NULL,
    "tag" "RatingTag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "againstId" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardSet_series_idx" ON "CardSet"("series");

-- CreateIndex
CREATE INDEX "CardSet_code_idx" ON "CardSet"("code");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Card_setId_localId_key" ON "Card"("setId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "User_parentToken_key" ON "User"("parentToken");

-- CreateIndex
CREATE INDEX "User_country_region_city_idx" ON "User"("country", "region", "city");

-- CreateIndex
CREATE INDEX "CollectionItem_cardId_spareQty_idx" ON "CollectionItem"("cardId", "spareQty");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_userId_cardId_variant_condition_language_key" ON "CollectionItem"("userId", "cardId", "variant", "condition", "language");

-- CreateIndex
CREATE INDEX "WantItem_cardId_idx" ON "WantItem"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "WantItem_userId_cardId_variant_key" ON "WantItem"("userId", "cardId", "variant");

-- CreateIndex
CREATE INDEX "TradeRequest_toId_status_idx" ON "TradeRequest"("toId", "status");

-- CreateIndex
CREATE INDEX "TradeRequest_fromId_status_idx" ON "TradeRequest"("fromId", "status");

-- CreateIndex
CREATE INDEX "Rating_toId_idx" ON "Rating"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_requestId_fromId_key" ON "Rating"("requestId", "fromId");

-- CreateIndex
CREATE INDEX "Report_resolvedAt_idx" ON "Report"("resolvedAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantItem" ADD CONSTRAINT "WantItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantItem" ADD CONSTRAINT "WantItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRequest" ADD CONSTRAINT "TradeRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRequest" ADD CONSTRAINT "TradeRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRequestItem" ADD CONSTRAINT "TradeRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TradeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRequestItem" ADD CONSTRAINT "TradeRequestItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TradeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_againstId_fkey" FOREIGN KEY ("againstId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

