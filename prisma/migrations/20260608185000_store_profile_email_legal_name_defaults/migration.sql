ALTER TABLE "StoreProfile" ALTER COLUMN "legalName" SET DEFAULT '';
ALTER TABLE "StoreProfile" ALTER COLUMN "email" SET DEFAULT 'rosagiroatacado@gmail.com';

UPDATE "StoreProfile"
SET "legalName" = ''
WHERE "id" = 'main'
  AND "legalName" IN (
    'RosaGiro Comércio de Cosméticos Ltda.',
    'RosaGiro Comercio de Cosmeticos Ltda.',
    'RosaGiro化妆品贸易有限公司'
  );

UPDATE "StoreProfile"
SET "email" = 'rosagiroatacado@gmail.com'
WHERE "id" = 'main'
  AND "email" IN ('contato@rosagiro.local', 'contato@belaviva.local');
