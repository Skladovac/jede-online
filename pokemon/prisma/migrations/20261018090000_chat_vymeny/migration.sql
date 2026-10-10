-- Chat u výměny.
CREATE TABLE "TradeMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TradeMessage_requestId_createdAt_idx" ON "TradeMessage"("requestId", "createdAt");
ALTER TABLE "TradeMessage" ADD CONSTRAINT "TradeMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TradeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradeMessage" ADD CONSTRAINT "TradeMessage_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
