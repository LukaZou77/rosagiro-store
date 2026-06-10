-- Add product SKU variants for color/model stock selection.
CREATE TABLE "ProductSku" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductSku_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductSku"
  ADD CONSTRAINT "ProductSku_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductSku_productId_code_key" ON "ProductSku"("productId", "code");
CREATE INDEX "ProductSku_productId_active_sortOrder_idx" ON "ProductSku"("productId", "active", "sortOrder");

ALTER TABLE "OrderItem"
  ADD COLUMN "productSkuId" TEXT,
  ADD COLUMN "productSkuName" TEXT,
  ADD COLUMN "productSkuCode" TEXT;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productSkuId_fkey"
  FOREIGN KEY ("productSkuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OrderItem_productSkuId_idx" ON "OrderItem"("productSkuId");
