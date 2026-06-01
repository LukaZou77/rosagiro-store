-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressLatitude" DOUBLE PRECISION,
ADD COLUMN     "addressLongitude" DOUBLE PRECISION,
ADD COLUMN     "addressMatchCheckedAt" TIMESTAMP(3),
ADD COLUMN     "addressMatchFormatted" TEXT,
ADD COLUMN     "addressMatchGranularity" TEXT,
ADD COLUMN     "addressMatchMessage" TEXT,
ADD COLUMN     "addressMatchPlaceId" TEXT,
ADD COLUMN     "addressMatchProvider" TEXT,
ADD COLUMN     "addressMatchStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED';

-- CreateIndex
CREATE INDEX "Order_addressMatchStatus_idx" ON "Order"("addressMatchStatus");
