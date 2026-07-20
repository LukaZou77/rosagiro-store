-- Retire the imported-rate implementation without deleting orders.
UPDATE "Order"
SET "shippingMethod" = 'PADRAO'
WHERE "shippingMethod"::text = 'ANJUN_D2D_PICKUP';

ALTER TABLE "Order" ALTER COLUMN "shippingMethod" DROP DEFAULT;
ALTER TYPE "ShippingMethod" RENAME TO "ShippingMethod_legacy";
CREATE TYPE "ShippingMethod" AS ENUM ('PADRAO', 'EXPRESSA', 'MELHOR_ENVIO', 'RETIRADA_LOCAL');
ALTER TABLE "Order"
ALTER COLUMN "shippingMethod" TYPE "ShippingMethod"
USING ("shippingMethod"::text::"ShippingMethod");
ALTER TABLE "Order" ALTER COLUMN "shippingMethod" SET DEFAULT 'PADRAO';
DROP TYPE "ShippingMethod_legacy";

DROP TABLE IF EXISTS "ShippingRate";
DROP TABLE IF EXISTS "ShippingRateImport";

DELETE FROM "LaunchReadinessItem" AS retired
USING "LaunchReadinessItem" AS current
WHERE retired."itemKey" = 'shipping-anjun-rates'
  AND current."itemKey" = 'shipping-melhor-envio';

UPDATE "LaunchReadinessItem"
SET "itemKey" = 'shipping-melhor-envio',
    "title" = 'Melhor Envio e regras de frete',
    "description" = 'Confirmar token de producao, origem de envio, CEPs, peso dos produtos e perfis tecnicos de embalagem.'
WHERE "itemKey" = 'shipping-anjun-rates';

ALTER TABLE "StoreProfile"
ALTER COLUMN "shippingNote" SET DEFAULT 'Enviamos para todo o Brasil com cotacao online por CEP antes do pagamento.';

UPDATE "StoreProfile"
SET "shippingNote" = 'Enviamos para todo o Brasil com cotacao online por CEP antes do pagamento.'
WHERE "shippingNote" ILIKE '%Anjun%';
