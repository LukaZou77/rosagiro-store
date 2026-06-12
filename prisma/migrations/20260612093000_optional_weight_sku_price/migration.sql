-- Allow product weight to be omitted while keeping freight fallback in application code.
ALTER TABLE "Product" ALTER COLUMN "weightGrams" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "weightGrams" DROP NOT NULL;

-- Optional SKU-level price. NULL means the SKU uses the parent product price.
ALTER TABLE "ProductSku" ADD COLUMN "priceCents" INTEGER;
