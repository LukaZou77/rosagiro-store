ALTER TABLE "Order" ADD COLUMN "gclid" TEXT;
ALTER TABLE "Order" ADD COLUMN "gbraid" TEXT;
ALTER TABLE "Order" ADD COLUMN "wbraid" TEXT;
ALTER TABLE "Order" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "Order" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "Order" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "Order" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "Order" ADD COLUMN "utmContent" TEXT;

CREATE INDEX "Order_gclid_idx" ON "Order"("gclid");
