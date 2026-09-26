ALTER TABLE "WhatsAppClickEvent"
ADD COLUMN "inquiryReference" TEXT;

ALTER TABLE "WhatsAppLead"
ADD COLUMN "inquiryReference" TEXT,
ADD COLUMN "clickEventId" TEXT,
ADD COLUMN "clickOccurredAt" TIMESTAMP(3),
ADD COLUMN "clickPathSnapshot" TEXT,
ADD COLUMN "clickUtmSource" TEXT,
ADD COLUMN "clickUtmMedium" TEXT,
ADD COLUMN "clickUtmCampaign" TEXT;

CREATE UNIQUE INDEX "WhatsAppClickEvent_inquiryReference_key"
ON "WhatsAppClickEvent"("inquiryReference");

CREATE UNIQUE INDEX "WhatsAppLead_inquiryReference_key"
ON "WhatsAppLead"("inquiryReference");

CREATE UNIQUE INDEX "WhatsAppLead_clickEventId_key"
ON "WhatsAppLead"("clickEventId");

ALTER TABLE "WhatsAppLead"
ADD CONSTRAINT "WhatsAppLead_clickEventId_fkey"
FOREIGN KEY ("clickEventId") REFERENCES "WhatsAppClickEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
