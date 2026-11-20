-- Preserve terminal validation decisions too: a rejected concurrent retry must
-- not later create an order after the buyer was told it was safe to change it.
CREATE TABLE "CheckoutAttempt" (
    "id" VARCHAR(36) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "error" TEXT,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);
