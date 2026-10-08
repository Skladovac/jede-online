-- Historie cen karet (graf na detailu karty).
CREATE TABLE "CardPrice" (
    "cardId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "eur" DECIMAL(10,2),
    "reverseEur" DECIMAL(10,2),

    CONSTRAINT "CardPrice_pkey" PRIMARY KEY ("cardId","day")
);
