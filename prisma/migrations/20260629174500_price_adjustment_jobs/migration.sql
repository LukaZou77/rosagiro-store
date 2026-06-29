-- CreateTable
CREATE TABLE "PriceAdjustmentJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "processedProducts" INTEGER NOT NULL DEFAULT 0,
    "adjustedProducts" INTEGER NOT NULL DEFAULT 0,
    "adjustedSkus" INTEGER NOT NULL DEFAULT 0,
    "skippedProducts" INTEGER NOT NULL DEFAULT 0,
    "skippedSkus" INTEGER NOT NULL DEFAULT 0,
    "descriptionWarnings" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdByAdminEmail" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAdjustmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceAdjustmentJob_status_createdAt_idx" ON "PriceAdjustmentJob"("status", "createdAt");
