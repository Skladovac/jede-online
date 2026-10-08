-- idProduct Cardmarketu u karty (čerstvé ceny z denního ceníku).
ALTER TABLE "Card" ADD COLUMN "cmProductId" INTEGER;
CREATE INDEX "Card_cmProductId_idx" ON "Card"("cmProductId");
