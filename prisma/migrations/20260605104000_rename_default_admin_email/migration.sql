UPDATE "AdminUser"
SET "email" = 'admin@rosagiro.local'
WHERE "email" = 'admin@belaviva.local'
  AND NOT EXISTS (
    SELECT 1 FROM "AdminUser" WHERE "email" = 'admin@rosagiro.local'
  );
