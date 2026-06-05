ALTER TABLE "StoreProfile" ALTER COLUMN "storeName" SET DEFAULT 'RosaGiro';
ALTER TABLE "StoreProfile" ALTER COLUMN "legalName" SET DEFAULT 'RosaGiro Comércio de Cosméticos Ltda.';
ALTER TABLE "StoreProfile" ALTER COLUMN "email" SET DEFAULT 'contato@rosagiro.local';

UPDATE "StoreProfile"
SET "storeName" = 'RosaGiro'
WHERE "id" = 'main' AND "storeName" = 'Bela Viva';

UPDATE "StoreProfile"
SET "legalName" = 'RosaGiro Comércio de Cosméticos Ltda.'
WHERE "id" = 'main'
  AND "legalName" IN ('Bela Viva Comércio de Beleza Ltda.', 'Bela Viva Comercio de Beleza Ltda.');

UPDATE "StoreProfile"
SET "email" = 'contato@rosagiro.local'
WHERE "id" = 'main' AND "email" = 'contato@belaviva.local';

UPDATE "Brand"
SET
  "slug" = 'rosagiro',
  "name" = 'RosaGiro',
  "logo" = 'RG',
  "origin" = CASE WHEN "origin" = 'Brasil' THEN 'São Paulo, Brasil' ELSE "origin" END,
  "descriptionPt" = CASE
    WHEN "descriptionPt" = 'Curadoria própria para organizar rotinas de beleza.'
      THEN 'Curadoria própria para organizar compras de cosméticos no atacado.'
    ELSE "descriptionPt"
  END
WHERE "slug" = 'bela-viva'
  AND "name" = 'Bela Viva'
  AND NOT EXISTS (
    SELECT 1 FROM "Brand" WHERE "slug" = 'rosagiro' OR "name" = 'RosaGiro'
  );

UPDATE "Brand"
SET "logo" = 'RG'
WHERE "slug" = 'rosagiro' AND "logo" = 'BV';

UPDATE "Product"
SET "badges" = array_replace("badges", 'Bela Viva', 'RosaGiro')
WHERE 'Bela Viva' = ANY("badges");

UPDATE "AdminUser"
SET "name" = 'RosaGiro Admin'
WHERE "name" = 'Bela Viva Admin';

UPDATE "SiteInfoPage"
SET
  "title" = replace("title", 'Bela Viva', 'RosaGiro'),
  "description" = replace("description", 'Bela Viva', 'RosaGiro'),
  "sections" = replace("sections"::text, 'Bela Viva', 'RosaGiro')::jsonb
WHERE "title" LIKE '%Bela Viva%'
  OR "description" LIKE '%Bela Viva%'
  OR "sections"::text LIKE '%Bela Viva%';

UPDATE "LaunchReadinessItem"
SET
  "title" = replace("title", 'Bela Viva', 'RosaGiro'),
  "description" = replace("description", 'Bela Viva', 'RosaGiro'),
  "notes" = replace("notes", 'Bela Viva', 'RosaGiro')
WHERE "title" LIKE '%Bela Viva%'
  OR "description" LIKE '%Bela Viva%'
  OR "notes" LIKE '%Bela Viva%';
