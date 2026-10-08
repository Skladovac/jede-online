-- Čas zveřejnění nabídky / poptávky (úprava poznámky už nabídku neposouvá mezi nejnovější).
ALTER TABLE "CollectionItem" ADD COLUMN "offeredAt" TIMESTAMP(3);
ALTER TABLE "ProductItem" ADD COLUMN "offeredAt" TIMESTAMP(3);
ALTER TABLE "WantItem" ADD COLUMN "buyAt" TIMESTAMP(3);
ALTER TABLE "ProductWant" ADD COLUMN "buyAt" TIMESTAMP(3);

-- Stávající nabídky a poptávky: nejlepší odhad je poslední změna.
UPDATE "CollectionItem" SET "offeredAt" = "updatedAt" WHERE "spareQty" > 0 AND "offerType" IS NOT NULL;
UPDATE "ProductItem" SET "offeredAt" = "updatedAt" WHERE "spareQty" > 0 AND "offerType" IS NOT NULL;
UPDATE "WantItem" SET "buyAt" = "updatedAt" WHERE "buy";
UPDATE "ProductWant" SET "buyAt" = "updatedAt" WHERE "buy";

-- Indexy pro tržiště, nejnovější nabídky a denní e-mail teď podle času zveřejnění.
DROP INDEX IF EXISTS "CollectionItem_offers_updated_idx";
DROP INDEX IF EXISTS "ProductItem_offers_updated_idx";
DROP INDEX IF EXISTS "WantItem_buy_updated_idx";
CREATE INDEX "CollectionItem_offers_offered_idx" ON "CollectionItem"("offeredAt" DESC)
  WHERE "spareQty" > 0 AND "offerType" IS NOT NULL AND "hiddenAt" IS NULL;
CREATE INDEX "ProductItem_offers_offered_idx" ON "ProductItem"("offeredAt" DESC)
  WHERE "spareQty" > 0 AND "offerType" IS NOT NULL AND "hiddenAt" IS NULL;
CREATE INDEX "WantItem_buy_at_idx" ON "WantItem"("buyAt" DESC) WHERE "buy";

-- Odkaz rodiče: v databázi jen otisk (sha256) jako u ostatních přístupových odkazů. Staré odkazy dál fungují,
-- protože aplikace příchozí token před hledáním také zahashuje.
UPDATE "User" SET "parentToken" = encode(sha256(convert_to("parentToken", 'UTF8')), 'hex') WHERE "parentToken" IS NOT NULL;
