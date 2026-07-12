CREATE TYPE "AnalyticsPeriodType" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');
CREATE TYPE "WhatsAppLeadStatus" AS ENUM ('QUALIFIED', 'WON', 'LOST');

CREATE TABLE "AnalyticsVisitorDay" (
    "id" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "whatsappClicks" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsVisitorDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppClickEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "linkKind" TEXT NOT NULL,
    "productId" TEXT,
    "productSlug" TEXT,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppLead" (
    "id" TEXT NOT NULL,
    "status" "WhatsAppLeadStatus" NOT NULL DEFAULT 'QUALIFIED',
    "contactName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "whatsappDigits" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL DEFAULT 'WhatsApp',
    "sourcePath" TEXT,
    "customerId" TEXT,
    "productId" TEXT,
    "productNameSnapshot" TEXT,
    "orderId" TEXT,
    "orderNumberSnapshot" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdByAdminEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsPeriodAggregate" (
    "id" TEXT NOT NULL,
    "periodType" "AnalyticsPeriodType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "whatsappClicks" INTEGER NOT NULL DEFAULT 0,
    "whatsappSessions" INTEGER NOT NULL DEFAULT 0,
    "createdOrders" INTEGER NOT NULL DEFAULT 0,
    "canceledOrders" INTEGER NOT NULL DEFAULT 0,
    "paidOrders" INTEGER NOT NULL DEFAULT 0,
    "paidRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
    "wonLeads" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsPeriodAggregate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductDailyMetric" (
    "id" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "productKey" TEXT NOT NULL,
    "productId" TEXT,
    "productSlug" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "addToCartQuantity" INTEGER NOT NULL DEFAULT 0,
    "orderedUnits" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "paidUnits" INTEGER NOT NULL DEFAULT 0,
    "paidOrderCount" INTEGER NOT NULL DEFAULT 0,
    "paidRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsVisitorDay_eventDate_visitorHash_key" ON "AnalyticsVisitorDay"("eventDate", "visitorHash");
CREATE INDEX "AnalyticsVisitorDay_visitorHash_eventDate_idx" ON "AnalyticsVisitorDay"("visitorHash", "eventDate");

CREATE UNIQUE INDEX "WhatsAppClickEvent_eventId_key" ON "WhatsAppClickEvent"("eventId");
CREATE INDEX "WhatsAppClickEvent_eventDate_idx" ON "WhatsAppClickEvent"("eventDate");
CREATE INDEX "WhatsAppClickEvent_sessionHash_eventDate_idx" ON "WhatsAppClickEvent"("sessionHash", "eventDate");
CREATE INDEX "WhatsAppClickEvent_productId_eventDate_idx" ON "WhatsAppClickEvent"("productId", "eventDate");
CREATE INDEX "WhatsAppClickEvent_path_eventDate_idx" ON "WhatsAppClickEvent"("path", "eventDate");

CREATE INDEX "WhatsAppLead_status_qualifiedAt_idx" ON "WhatsAppLead"("status", "qualifiedAt");
CREATE INDEX "WhatsAppLead_whatsappDigits_qualifiedAt_idx" ON "WhatsAppLead"("whatsappDigits", "qualifiedAt");
CREATE INDEX "WhatsAppLead_customerId_idx" ON "WhatsAppLead"("customerId");
CREATE INDEX "WhatsAppLead_productId_idx" ON "WhatsAppLead"("productId");
CREATE INDEX "WhatsAppLead_orderId_idx" ON "WhatsAppLead"("orderId");

CREATE UNIQUE INDEX "AnalyticsPeriodAggregate_periodType_periodStart_key" ON "AnalyticsPeriodAggregate"("periodType", "periodStart");
CREATE INDEX "AnalyticsPeriodAggregate_periodStart_periodEnd_idx" ON "AnalyticsPeriodAggregate"("periodStart", "periodEnd");

CREATE UNIQUE INDEX "ProductDailyMetric_eventDate_productKey_key" ON "ProductDailyMetric"("eventDate", "productKey");
CREATE INDEX "ProductDailyMetric_productId_eventDate_idx" ON "ProductDailyMetric"("productId", "eventDate");
CREATE INDEX "ProductDailyMetric_eventDate_views_idx" ON "ProductDailyMetric"("eventDate", "views");
CREATE INDEX "ProductDailyMetric_eventDate_orderedUnits_idx" ON "ProductDailyMetric"("eventDate", "orderedUnits");
CREATE INDEX "ProductDailyMetric_eventDate_paidRevenueCents_idx" ON "ProductDailyMetric"("eventDate", "paidRevenueCents");

UPDATE "SiteInfoPage"
SET
  "sections" = (
    SELECT jsonb_agg(
      CASE
        WHEN section->>'title' = 'Dados de navegação e métricas' THEN jsonb_build_object(
          'title', 'Dados de navegação e métricas',
          'body', 'Para entender o uso da loja e melhorar o atendimento, registramos páginas visitadas, origem, tipo de dispositivo, localização aproximada e cliques de saída para o WhatsApp. O endereço IP não é armazenado: ele é transformado em identificador irreversível. Detalhes de navegação e cliques são mantidos por até 90 dias; registros diários pseudonimizados são mantidos por até 25 meses para comparações, e totais sem identificadores podem ser preservados para relatórios históricos. O rastreamento respeita sinais DNT e GPC.'
        )
        ELSE section
      END
    )
    FROM jsonb_array_elements("sections"::jsonb) AS section
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "pageKey" = 'privacy'
  AND jsonb_typeof("sections"::jsonb) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("sections"::jsonb) AS section
    WHERE section->>'title' = 'Dados de navegação e métricas'
  );
