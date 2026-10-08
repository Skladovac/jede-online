-- Nákupní cena (nepovinná) a denní snímky hodnoty sbírky pro přehled.
ALTER TABLE "CollectionItem" ADD COLUMN "purchasePriceCzk" INTEGER;
ALTER TABLE "ProductItem" ADD COLUMN "purchasePriceCzk" INTEGER;

CREATE TABLE "ValueSnapshot" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "valueCzk" INTEGER NOT NULL,
    "investedCzk" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ValueSnapshot_pkey" PRIMARY KEY ("userId","day")
);
