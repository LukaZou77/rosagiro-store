import "server-only";

import { headers } from "next/headers";

type LoginBucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const loginBuckets = new Map<string, LoginBucket>();

async function requestIp() {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  );
}

async function bucketKey(email: string) {
  const normalizedEmail = email.trim().toLowerCase() || "unknown";
  return `${await requestIp()}:${normalizedEmail}`;
}

export async function adminLoginRateLimitStatus(email: string) {
  const key = await bucketKey(email);
  const now = Date.now();
  const bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    loginBuckets.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: bucket.count < MAX_FAILURES,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

export async function recordAdminLoginFailure(email: string) {
  const key = await bucketKey(email);
  const now = Date.now();
  const bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    loginBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  bucket.count += 1;
}

export async function clearAdminLoginFailures(email: string) {
  loginBuckets.delete(await bucketKey(email));
}
