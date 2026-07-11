CREATE TYPE "AdminNotificationType" AS ENUM ('NEW_ORDER', 'ORDER_PAID');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'SENT', 'FAILED');

CREATE TABLE "SitePageView" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "path" TEXT NOT NULL,
    "referrerHost" TEXT,
    "countryCode" TEXT,
    "regionCode" TEXT,
    "city" TEXT,
    "deviceType" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePageView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "notificationType" "AdminNotificationType" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionHref" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "whatsappStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "whatsappMessageId" TEXT,
    "whatsappError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SitePageView_eventId_key" ON "SitePageView"("eventId");
CREATE INDEX "SitePageView_eventDate_idx" ON "SitePageView"("eventDate");
CREATE INDEX "SitePageView_visitorHash_eventDate_idx" ON "SitePageView"("visitorHash", "eventDate");
CREATE INDEX "SitePageView_sessionHash_occurredAt_idx" ON "SitePageView"("sessionHash", "occurredAt");
CREATE INDEX "SitePageView_path_eventDate_idx" ON "SitePageView"("path", "eventDate");
CREATE INDEX "SitePageView_countryCode_regionCode_city_eventDate_idx" ON "SitePageView"("countryCode", "regionCode", "city", "eventDate");

CREATE UNIQUE INDEX "AdminNotification_dedupeKey_key" ON "AdminNotification"("dedupeKey");
CREATE INDEX "AdminNotification_readAt_createdAt_idx" ON "AdminNotification"("readAt", "createdAt");
CREATE INDEX "AdminNotification_notificationType_createdAt_idx" ON "AdminNotification"("notificationType", "createdAt");

UPDATE "SiteInfoPage"
SET
  "sections" = "sections"::jsonb || '[{"title":"Dados de navegação e métricas","body":"Para entender o uso da loja e melhorar o atendimento, registramos páginas visitadas, origem da visita, tipo de dispositivo e localização aproximada por país, estado e cidade. O endereço IP não é armazenado: ele é transformado em um identificador irreversível usado apenas para estimativas e prevenção de duplicidade. Os detalhes de navegação são mantidos por até 90 dias e o rastreamento respeita sinais DNT e GPC do navegador."}]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "pageKey" = 'privacy'
  AND jsonb_typeof("sections"::jsonb) = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements("sections"::jsonb) AS section
    WHERE section->>'title' = 'Dados de navegação e métricas'
  );
