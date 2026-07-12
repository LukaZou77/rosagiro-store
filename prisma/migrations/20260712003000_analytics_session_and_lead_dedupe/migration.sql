CREATE TABLE "WhatsAppSessionDay" (
    "id" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppSessionDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppSessionDay_eventDate_sessionHash_key"
ON "WhatsAppSessionDay"("eventDate", "sessionHash");

CREATE INDEX "WhatsAppSessionDay_visitorHash_eventDate_idx"
ON "WhatsAppSessionDay"("visitorHash", "eventDate");

CREATE INDEX "WhatsAppSessionDay_firstSeenAt_idx"
ON "WhatsAppSessionDay"("firstSeenAt");

ALTER TABLE "WhatsAppLead" ADD COLUMN "dedupeKey" TEXT;

UPDATE "WhatsAppLead"
SET "dedupeKey" = 'legacy:' || "id"
WHERE "dedupeKey" IS NULL;

ALTER TABLE "WhatsAppLead" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "WhatsAppLead_dedupeKey_key" ON "WhatsAppLead"("dedupeKey");
