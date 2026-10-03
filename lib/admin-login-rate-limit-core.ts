import { createHmac } from "node:crypto";

export const ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
export const ADMIN_LOGIN_IP_LIMIT = 40;
export const ADMIN_LOGIN_IP_EMAIL_LIMIT = 8;

const IP_SCOPE = "admin-login:ip";
const IP_EMAIL_SCOPE = "admin-login:ip-email";
const HMAC_PURPOSE = "rosagiro:admin-login-rate-limit:v1";

export type AdminLoginCounterReceipt = {
  scope: string;
  keyHash: string;
  attempts: number;
  revision: bigint;
  expiresAtEpochMs: bigint;
};

export type AdminLoginAttemptStore = {
  consume(input: {
    ipScope: string;
    ipKeyHash: string;
    ipLimit: number;
    ipEmailScope: string;
    ipEmailKeyHash: string;
    ipEmailLimit: number;
    windowSeconds: number;
  }): Promise<{
    ip: AdminLoginCounterReceipt;
    ipEmail?: AdminLoginCounterReceipt;
  }>;
  clearIfUnchanged(receipt: AdminLoginCounterReceipt): Promise<boolean>;
};

export type AdminLoginRateLimitStatus =
  | {
      allowed: true;
      retryAfterSeconds: 0;
      ipEmailReceipt: AdminLoginCounterReceipt;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      reason: "ip" | "ip-email" | "unavailable";
    };

function normalizedEmail(email: string) {
  return email.trim().toLowerCase() || "unknown";
}

function hashKey(secret: string, scope: string, value: string) {
  if (!secret) throw new Error("Rate limit secret is unavailable.");
  return createHmac("sha256", secret)
    .update(HMAC_PURPOSE)
    .update("\0")
    .update(scope)
    .update("\0")
    .update(value)
    .digest("hex");
}

function retryAfterSeconds(expiresAtEpochMs: bigint) {
  return Math.max(1, Math.ceil((Number(expiresAtEpochMs) - Date.now()) / 1000));
}

function validReceipt(
  receipt: AdminLoginCounterReceipt | undefined,
  scope: string,
  keyHash: string
): receipt is AdminLoginCounterReceipt {
  return Boolean(
    receipt &&
      receipt.scope === scope &&
      receipt.keyHash === keyHash &&
      Number.isSafeInteger(receipt.attempts) &&
      receipt.attempts >= 1 &&
      typeof receipt.revision === "bigint" &&
      receipt.revision >= 1n &&
      typeof receipt.expiresAtEpochMs === "bigint" &&
      receipt.expiresAtEpochMs >= 1n &&
      receipt.expiresAtEpochMs <= BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export async function consumeAdminLoginAttemptCore(input: {
  store: AdminLoginAttemptStore;
  secret: string;
  clientIp: string;
  email: string;
  onUnavailable?: () => void;
}): Promise<AdminLoginRateLimitStatus> {
  try {
    const email = normalizedEmail(input.email);
    const ipKeyHash = hashKey(input.secret, IP_SCOPE, input.clientIp);
    const ipEmailKeyHash = hashKey(input.secret, IP_EMAIL_SCOPE, `${input.clientIp}\0${email}`);
    const consumed = await input.store.consume({
      ipScope: IP_SCOPE,
      ipKeyHash,
      ipLimit: ADMIN_LOGIN_IP_LIMIT,
      ipEmailScope: IP_EMAIL_SCOPE,
      ipEmailKeyHash,
      ipEmailLimit: ADMIN_LOGIN_IP_EMAIL_LIMIT,
      windowSeconds: ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS
    });

    if (!validReceipt(consumed.ip, IP_SCOPE, ipKeyHash)) {
      throw new Error("The IP login bucket returned an invalid receipt.");
    }

    if (consumed.ip.attempts > ADMIN_LOGIN_IP_LIMIT) {
      return {
        allowed: false,
        retryAfterSeconds: retryAfterSeconds(consumed.ip.expiresAtEpochMs),
        reason: "ip"
      };
    }

    const ipEmail = consumed.ipEmail;
    if (!validReceipt(ipEmail, IP_EMAIL_SCOPE, ipEmailKeyHash)) {
      throw new Error("The combined login bucket returned an invalid receipt.");
    }
    if (ipEmail.attempts > ADMIN_LOGIN_IP_EMAIL_LIMIT) {
      return {
        allowed: false,
        retryAfterSeconds: retryAfterSeconds(ipEmail.expiresAtEpochMs),
        reason: "ip-email"
      };
    }

    return { allowed: true, retryAfterSeconds: 0, ipEmailReceipt: ipEmail };
  } catch {
    input.onUnavailable?.();
    return {
      allowed: false,
      retryAfterSeconds: ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      reason: "unavailable"
    };
  }
}

export async function clearSuccessfulAdminLoginAttemptCore(input: {
  store: AdminLoginAttemptStore;
  receipt: AdminLoginCounterReceipt;
}) {
  return input.store.clearIfUnchanged(input.receipt);
}
