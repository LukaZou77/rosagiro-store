-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "baseBoxPieces" INTEGER,
ADD COLUMN     "baseBoxPriceCents" INTEGER,
ADD COLUMN     "basePriceCents" INTEGER;

-- AlterTable
ALTER TABLE "ProductSku" ADD COLUMN     "basePriceCents" INTEGER;

-- AlterTable
ALTER TABLE "StoreProfile" ADD COLUMN     "priceAdjustmentDirection" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "priceAdjustmentType" TEXT NOT NULL DEFAULT 'percent',
ADD COLUMN     "priceAdjustmentValue" INTEGER NOT NULL DEFAULT 0;
