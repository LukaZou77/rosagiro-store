-- Add soft-delete fields for admin product trash management.
ALTER TABLE "Product"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByAdminEmail" TEXT,
ADD COLUMN "deleteNote" TEXT;

CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
CREATE INDEX "Product_active_deletedAt_idx" ON "Product"("active", "deletedAt");
