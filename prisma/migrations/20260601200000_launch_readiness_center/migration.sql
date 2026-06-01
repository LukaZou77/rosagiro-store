CREATE TYPE "LaunchReadinessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

CREATE TABLE "LaunchReadinessItem" (
  "id" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "LaunchReadinessStatus" NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 2,
  "notes" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LaunchReadinessItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LaunchReadinessItem_itemKey_key" ON "LaunchReadinessItem"("itemKey");
CREATE INDEX "LaunchReadinessItem_group_sortOrder_idx" ON "LaunchReadinessItem"("group", "sortOrder");
CREATE INDEX "LaunchReadinessItem_status_priority_idx" ON "LaunchReadinessItem"("status", "priority");
