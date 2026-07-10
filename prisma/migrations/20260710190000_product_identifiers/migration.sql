ALTER TABLE "Product" ADD COLUMN "gtin" TEXT;
ALTER TABLE "Product" ADD COLUMN "mpn" TEXT;

CREATE INDEX "Product_gtin_idx" ON "Product"("gtin");
CREATE INDEX "Product_mpn_idx" ON "Product"("mpn");
