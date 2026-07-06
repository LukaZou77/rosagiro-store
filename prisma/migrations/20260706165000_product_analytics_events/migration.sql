-- CreateEnum
CREATE TYPE "ProductAnalyticsEventType" AS ENUM ('PRODUCT_VIEW', 'ADD_TO_CART');

-- CreateTable
CREATE TABLE "ProductAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" "ProductAnalyticsEventType" NOT NULL,
    "eventDate" DATE NOT NULL,
    "dedupeKey" TEXT,
    "anonymousId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSkuId" TEXT,
    "productSlug" TEXT NOT NULL,
    "productSkuCode" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAnalyticsEvent_dedupeKey_key" ON "ProductAnalyticsEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "ProductAnalyticsEvent_eventType_eventDate_idx" ON "ProductAnalyticsEvent"("eventType", "eventDate");

-- CreateIndex
CREATE INDEX "ProductAnalyticsEvent_productId_eventType_eventDate_idx" ON "ProductAnalyticsEvent"("productId", "eventType", "eventDate");

-- CreateIndex
CREATE INDEX "ProductAnalyticsEvent_productSkuId_eventType_eventDate_idx" ON "ProductAnalyticsEvent"("productSkuId", "eventType", "eventDate");

-- CreateIndex
CREATE INDEX "ProductAnalyticsEvent_productSlug_eventDate_idx" ON "ProductAnalyticsEvent"("productSlug", "eventDate");

-- AddForeignKey
ALTER TABLE "ProductAnalyticsEvent" ADD CONSTRAINT "ProductAnalyticsEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnalyticsEvent" ADD CONSTRAINT "ProductAnalyticsEvent_productSkuId_fkey" FOREIGN KEY ("productSkuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;
