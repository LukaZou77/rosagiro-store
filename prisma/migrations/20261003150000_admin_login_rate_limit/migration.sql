CREATE TABLE "AdminLoginRateLimitBucket" (
    "scope" TEXT NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdminLoginRateLimitBucket_pkey" PRIMARY KEY ("scope", "keyHash")
);

CREATE INDEX "AdminLoginRateLimitBucket_expiresAt_idx"
ON "AdminLoginRateLimitBucket"("expiresAt");
