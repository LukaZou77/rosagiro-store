-- Extend payment tracking for Mercado Pago Checkout Pro sandbox.
ALTER TABLE "Payment"
  ADD COLUMN "providerPreferenceId" TEXT,
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "providerExternalReference" TEXT,
  ADD COLUMN "providerInitPoint" TEXT,
  ADD COLUMN "providerSandboxInitPoint" TEXT,
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "providerStatusDetail" TEXT,
  ADD COLUMN "providerPayload" JSONB,
  ADD COLUMN "syncError" TEXT,
  ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_providerPreferenceId_key" ON "Payment"("providerPreferenceId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
  "dedupeKey" TEXT NOT NULL,
  "providerEventId" TEXT,
  "requestId" TEXT,
  "dataId" TEXT,
  "eventType" TEXT,
  "action" TEXT,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_dedupeKey_key" ON "PaymentWebhookEvent"("dedupeKey");
CREATE INDEX "PaymentWebhookEvent_provider_dataId_idx" ON "PaymentWebhookEvent"("provider", "dataId");
CREATE INDEX "PaymentWebhookEvent_provider_requestId_idx" ON "PaymentWebhookEvent"("provider", "requestId");
