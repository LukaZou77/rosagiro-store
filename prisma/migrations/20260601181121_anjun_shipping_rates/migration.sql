-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShippingMethod" ADD VALUE 'ANJUN_D2D_PICKUP';
ALTER TYPE "ShippingMethod" ADD VALUE 'RETIRADA_LOCAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCarrier" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingEstimate" TEXT,
ADD COLUMN     "shippingQuoteMessage" TEXT,
ADD COLUMN     "shippingQuoteSnapshot" JSONB,
ADD COLUMN     "shippingQuoteStatus" TEXT NOT NULL DEFAULT 'NOT_QUOTED',
ADD COLUMN     "shippingRateId" TEXT,
ADD COLUMN     "shippingService" TEXT,
ADD COLUMN     "shippingServiceLabel" TEXT,
ADD COLUMN     "shippingWeightGrams" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingZone" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "weightGrams" INTEGER NOT NULL DEFAULT 150;

-- CreateTable
CREATE TABLE "ShippingRateImport" (
    "id" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "originKey" TEXT NOT NULL,
    "originLabel" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL,
    "stateCount" INTEGER NOT NULL,
    "zoneCount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingRateImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "originKey" TEXT NOT NULL,
    "originLabel" TEXT NOT NULL,
    "destinationState" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cepStart" INTEGER NOT NULL,
    "cepEnd" INTEGER NOT NULL,
    "zone" TEXT NOT NULL,
    "ratesCents" INTEGER[],
    "additionalKgCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingRateImport_carrier_service_originKey_active_idx" ON "ShippingRateImport"("carrier", "service", "originKey", "active");

-- CreateIndex
CREATE INDEX "ShippingRate_active_carrier_service_originKey_idx" ON "ShippingRate"("active", "carrier", "service", "originKey");

-- CreateIndex
CREATE INDEX "ShippingRate_destinationState_cepStart_cepEnd_idx" ON "ShippingRate"("destinationState", "cepStart", "cepEnd");

-- CreateIndex
CREATE INDEX "ShippingRate_importId_idx" ON "ShippingRate"("importId");

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ShippingRateImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
