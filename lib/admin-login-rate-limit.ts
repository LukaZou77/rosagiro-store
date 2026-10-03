import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requestClientIp } from "@/lib/request-client-ip";
import {
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  type AdminLoginAttemptStore,
  type AdminLoginCounterReceipt,
  clearSuccessfulAdminLoginAttemptCore,
  consumeAdminLoginAttemptCore
} from "@/lib/admin-login-rate-limit-core";

type CounterRow = {
  scope: string;
  keyHash: string;
  attempts: number;
  revision: bigint;
  expiresAtEpochMs: bigint;
};

const loggedFailures = new Set<string>();

function logFailureOnce(code: "client-ip-unavailable" | "consume-unavailable" | "clear-unavailable") {
  if (loggedFailures.has(code)) return;
  loggedFailures.add(code);
  console.error(`[admin-login-rate-limit] ${code}`);
}

const store: AdminLoginAttemptStore = {
  async consume(input) {
    const rows = await prisma.$queryRaw<CounterRow[]>`
      WITH request_clock AS (
        SELECT clock_timestamp() AS now
      ), ip_bucket AS (
        INSERT INTO "AdminLoginRateLimitBucket" AS bucket
          ("scope", "keyHash", "attempts", "revision", "expiresAt")
        SELECT
          ${input.ipScope},
          ${input.ipKeyHash},
          1,
          1::bigint,
          request_clock.now + make_interval(secs => ${input.windowSeconds}::double precision)
        FROM request_clock
        WHERE true
        ON CONFLICT ("scope", "keyHash") DO UPDATE SET
          "attempts" = CASE
            WHEN bucket."expiresAt" <= EXCLUDED."expiresAt" - make_interval(secs => ${input.windowSeconds}::double precision)
              THEN 1
            ELSE LEAST(bucket."attempts", ${input.ipLimit}) + 1
          END,
          "revision" = bucket."revision" + 1,
          "expiresAt" = CASE
            WHEN bucket."expiresAt" <= EXCLUDED."expiresAt" - make_interval(secs => ${input.windowSeconds}::double precision)
              THEN EXCLUDED."expiresAt"
            ELSE bucket."expiresAt"
          END
        RETURNING "scope", "keyHash", "attempts", "revision", "expiresAt"
      ), ip_email_bucket AS (
        INSERT INTO "AdminLoginRateLimitBucket" AS bucket
          ("scope", "keyHash", "attempts", "revision", "expiresAt")
        SELECT
          ${input.ipEmailScope},
          ${input.ipEmailKeyHash},
          1,
          1::bigint,
          request_clock.now + make_interval(secs => ${input.windowSeconds}::double precision)
        FROM request_clock
        CROSS JOIN ip_bucket
        WHERE ip_bucket."attempts" <= ${input.ipLimit}
        ON CONFLICT ("scope", "keyHash") DO UPDATE SET
          "attempts" = CASE
            WHEN bucket."expiresAt" <= EXCLUDED."expiresAt" - make_interval(secs => ${input.windowSeconds}::double precision)
              THEN 1
            ELSE LEAST(bucket."attempts", ${input.ipEmailLimit}) + 1
          END,
          "revision" = bucket."revision" + 1,
          "expiresAt" = CASE
            WHEN bucket."expiresAt" <= EXCLUDED."expiresAt" - make_interval(secs => ${input.windowSeconds}::double precision)
              THEN EXCLUDED."expiresAt"
            ELSE bucket."expiresAt"
          END
        RETURNING "scope", "keyHash", "attempts", "revision", "expiresAt"
      )
      SELECT
        "scope",
        "keyHash",
        "attempts",
        "revision",
        (extract(epoch FROM "expiresAt") * 1000)::bigint AS "expiresAtEpochMs"
      FROM ip_bucket
      UNION ALL
      SELECT
        "scope",
        "keyHash",
        "attempts",
        "revision",
        (extract(epoch FROM "expiresAt") * 1000)::bigint AS "expiresAtEpochMs"
      FROM ip_email_bucket
    `;

    const ip = rows.find((row) => row.scope === input.ipScope && row.keyHash === input.ipKeyHash);
    const ipEmail = rows.find(
      (row) => row.scope === input.ipEmailScope && row.keyHash === input.ipEmailKeyHash
    );
    if (!ip) throw new Error("The IP login bucket was not consumed.");
    return { ip, ipEmail };
  },

  async clearIfUnchanged(receipt) {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "AdminLoginRateLimitBucket"
      WHERE "scope" = ${receipt.scope}
        AND "keyHash" = ${receipt.keyHash}
        AND "revision" = ${receipt.revision}
        AND (extract(epoch FROM "expiresAt") * 1000)::bigint = ${receipt.expiresAtEpochMs}
    `;
    return deleted === 1;
  }
};

export async function consumeAdminLoginAttempt(email: string) {
  let clientIp: string;
  try {
    clientIp = requestClientIp(await headers());
  } catch {
    logFailureOnce("consume-unavailable");
    return {
      allowed: false as const,
      retryAfterSeconds: ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      reason: "unavailable" as const
    };
  }
  if (clientIp === "unknown" && process.env.NODE_ENV === "production") {
    logFailureOnce("client-ip-unavailable");
    return {
      allowed: false as const,
      retryAfterSeconds: ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      reason: "unavailable" as const
    };
  }

  return consumeAdminLoginAttemptCore({
    store,
    secret: process.env.SESSION_SECRET || "",
    clientIp,
    email,
    onUnavailable: () => logFailureOnce("consume-unavailable")
  });
}

export async function clearSuccessfulAdminLoginAttempt(receipt: AdminLoginCounterReceipt) {
  try {
    return await clearSuccessfulAdminLoginAttemptCore({ store, receipt });
  } catch {
    logFailureOnce("clear-unavailable");
    throw new Error("Admin login rate limiter unavailable.");
  }
}

export async function deleteExpiredAdminLoginRateLimitBuckets(limit = 1_000) {
  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 1_000;
  const boundedLimit = Math.max(1, Math.min(5_000, requestedLimit));
  return prisma.$executeRaw`
    WITH expired AS (
      SELECT "scope", "keyHash"
      FROM "AdminLoginRateLimitBucket"
      WHERE "expiresAt" <= clock_timestamp()
      ORDER BY "expiresAt"
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "AdminLoginRateLimitBucket" AS bucket
    USING expired
    WHERE bucket."scope" = expired."scope"
      AND bucket."keyHash" = expired."keyHash"
      AND bucket."expiresAt" <= clock_timestamp()
  `;
}
