-- Nullable additions preserve existing orders. A persistent unique key prevents
-- a retry (including a concurrent process) from creating a second order.
ALTER TABLE "Order" ADD COLUMN "checkoutAttemptId" VARCHAR(36),
                    ADD COLUMN "checkoutRequestHash" VARCHAR(64);
CREATE UNIQUE INDEX "Order_checkoutAttemptId_key" ON "Order"("checkoutAttemptId");

-- Never automatically release an external-payment initialization claim after a
-- timeout: the provider may have accepted it. Recover the existing order instead.
ALTER TABLE "Payment" ADD COLUMN "initializationStartedAt" TIMESTAMP(3);
