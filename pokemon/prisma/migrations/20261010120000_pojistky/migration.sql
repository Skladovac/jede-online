-- Duplicity, které vznikly souběžnými požadavky (NULL se v unikátním indexu nepočítá jako shoda).
DELETE FROM "WantItem" w USING "WantItem" o
WHERE w."variant" IS NULL AND o."variant" IS NULL AND w."userId" = o."userId" AND w."cardId" = o."cardId"
  AND (w."createdAt", w."id") > (o."createdAt", o."id");

DELETE FROM "TradeRequest" t USING "TradeRequest" o
WHERE t."status" = 'DRAFT' AND o."status" = 'DRAFT' AND t."fromId" = o."fromId" AND t."toId" = o."toId"
  AND (t."createdAt", t."id") > (o."createdAt", o."id");

DELETE FROM "Rating" r USING "Rating" o
WHERE r."requestId" IS NULL AND o."requestId" IS NULL AND r."fromId" = o."fromId" AND r."toId" = o."toId"
  AND (r."createdAt", r."id") > (o."createdAt", o."id");

-- Pojistky proti duplicitám (dvojklik, dvě záložky).
CREATE UNIQUE INDEX "WantItem_user_card_any_variant_key" ON "WantItem"("userId", "cardId") WHERE "variant" IS NULL;
CREATE UNIQUE INDEX "TradeRequest_draft_pair_key" ON "TradeRequest"("fromId", "toId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "Rating_free_pair_key" ON "Rating"("fromId", "toId") WHERE "requestId" IS NULL;

-- Rychlost: položky poptávky, tržiště, nejnovější nabídky a denní e-mail.
CREATE INDEX "TradeRequestItem_requestId_idx" ON "TradeRequestItem"("requestId");
CREATE INDEX "CollectionItem_offers_updated_idx" ON "CollectionItem"("updatedAt" DESC)
  WHERE "spareQty" > 0 AND "offerType" IS NOT NULL AND "hiddenAt" IS NULL;
CREATE INDEX "ProductItem_offers_updated_idx" ON "ProductItem"("updatedAt" DESC)
  WHERE "spareQty" > 0 AND "offerType" IS NOT NULL AND "hiddenAt" IS NULL;
CREATE INDEX "WantItem_buy_updated_idx" ON "WantItem"("updatedAt" DESC) WHERE "buy";
