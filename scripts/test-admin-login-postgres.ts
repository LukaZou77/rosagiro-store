import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/src/generated/prisma/client";

const TEST_DATABASE_URL = "postgresql://security_test@127.0.0.1:55439/postgres?sslmode=disable";
const testUrl = new URL(TEST_DATABASE_URL);
const allowedDatabases = new Set(["postgres", "security_test"]);
const databaseName = decodeURIComponent(testUrl.pathname.slice(1));

assert.equal(testUrl.protocol, "postgresql:");
assert.equal(testUrl.hostname, "127.0.0.1");
assert.equal(testUrl.port, "55439");
assert.equal(decodeURIComponent(testUrl.username), "security_test");
assert.ok(allowedDatabases.has(databaseName));

// This test must never discover or use a project/production connection string.
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
process.env.SESSION_SECRET = "admin-login-postgres-integration-test-only";
process.env.VERCEL = "1";

const projectRoot = resolve(import.meta.dirname, "..");
const moduleUrl = (relativePath: string) => pathToFileURL(resolve(projectRoot, relativePath)).href;
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: TEST_DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 2_000,
    allowExitOnIdle: true
  })
});

let requestHeaders = new Headers({ "x-vercel-forwarded-for": "203.0.113.10" });

mock.module(moduleUrl("lib/db.ts"), { exports: { prisma } });
mock.module("next/headers", { exports: { headers: async () => requestHeaders } });

const limiter = await import("../lib/admin-login-rate-limit");

type BucketRow = {
  scope: string;
  attempts: number;
  revision: bigint;
  expiresAtEpochMs: bigint;
};

function useClientIp(ip: string) {
  requestHeaders = new Headers({ "x-vercel-forwarded-for": ip });
}

async function applyMigration() {
  const migrationPath = resolve(
    projectRoot,
    "prisma/migrations/20261003150000_admin_login_rate_limit/migration.sql"
  );
  const migration = await readFile(migrationPath, "utf8");
  const statements = migration
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "AdminLoginRateLimitBucket"');
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function buckets() {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT
      "scope",
      "attempts",
      "revision",
      (extract(epoch FROM "expiresAt") * 1000)::bigint AS "expiresAtEpochMs"
    FROM "AdminLoginRateLimitBucket"
    ORDER BY "scope"
  `;
}

before(async () => {
  const [identity] = await prisma.$queryRaw<
    Array<{ database: string; username: string; address: string; port: number }>
  >`
    SELECT
      current_database() AS database,
      current_user AS username,
      host(inet_server_addr()) AS address,
      inet_server_port() AS port
  `;
  assert.deepEqual(identity, {
    database: databaseName,
    username: "security_test",
    address: "127.0.0.1",
    port: 55439
  });
  await applyMigration();
});

beforeEach(async () => {
  useClientIp("203.0.113.10");
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AdminLoginRateLimitBucket"');
});

after(async () => {
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "AdminLoginRateLimitBucket"');
  await prisma.$disconnect();
  mock.restoreAll();
});

test("applies the additive migration with its expiry index", async () => {
  const [table] = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public."AdminLoginRateLimitBucket"')::text AS "tableName"
  `;
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'AdminLoginRateLimitBucket'
  `;

  assert.equal(table.tableName, '"AdminLoginRateLimitBucket"');
  assert.ok(indexes.some((index) => index.indexname === "AdminLoginRateLimitBucket_expiresAt_idx"));
});

test("admits only eight of sixteen concurrent attempts for one IP and email", async () => {
  const results = await Promise.all(
    Array.from({ length: 16 }, () => limiter.consumeAdminLoginAttempt("admin@example.test"))
  );
  const rows = await buckets();

  assert.equal(results.filter((result) => result.allowed).length, 8);
  assert.equal(results.filter((result) => !result.allowed).length, 8);
  assert.equal(rows.find((row) => row.scope === "admin-login:ip")?.attempts, 16);
  assert.equal(rows.find((row) => row.scope === "admin-login:ip-email")?.attempts, 9);
});

test("blocks the forty-first IP attempt without creating another email bucket", async () => {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const result = await limiter.consumeAdminLoginAttempt(`admin-${attempt}@example.test`);
    assert.equal(result.allowed, true, `attempt ${attempt}`);
  }

  const blocked = await limiter.consumeAdminLoginAttempt("admin-41@example.test");
  const rows = await buckets();
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "ip");
  assert.equal(rows.length, 41);
  assert.equal(rows.find((row) => row.scope === "admin-login:ip")?.attempts, 41);
});

test("resets expired buckets using the database clock", async () => {
  await limiter.consumeAdminLoginAttempt("admin@example.test");
  await limiter.consumeAdminLoginAttempt("admin@example.test");
  await prisma.$executeRaw`
    UPDATE "AdminLoginRateLimitBucket"
    SET "expiresAt" = clock_timestamp() - interval '1 second'
  `;

  const refreshed = await limiter.consumeAdminLoginAttempt("admin@example.test");
  const rows = await buckets();
  assert.equal(refreshed.allowed, true);
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every((row) => row.attempts === 1 && row.expiresAtEpochMs > BigInt(Date.now())),
    JSON.stringify(rows, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
});

test("conditional success clear preserves a newer concurrent combo attempt", async () => {
  const first = await limiter.consumeAdminLoginAttempt("admin@example.test");
  assert.equal(first.allowed, true);
  const second = await limiter.consumeAdminLoginAttempt("admin@example.test");
  assert.equal(second.allowed, true);

  assert.equal(await limiter.clearSuccessfulAdminLoginAttempt(first.ipEmailReceipt), false);
  const rowsBeforeCurrentClear = await buckets();
  assert.equal(
    rowsBeforeCurrentClear.find((row) => row.scope === "admin-login:ip-email")?.attempts,
    2
  );
  assert.equal(await limiter.clearSuccessfulAdminLoginAttempt(second.ipEmailReceipt), true);
  const rows = await buckets();
  assert.equal(rows.some((row) => row.scope === "admin-login:ip-email"), false);
  assert.ok(rows.some((row) => row.scope === "admin-login:ip"));
});

test("cleanup racing a consume leaves the refreshed buckets active", async () => {
  await limiter.consumeAdminLoginAttempt("admin@example.test");
  await prisma.$executeRaw`
    UPDATE "AdminLoginRateLimitBucket"
    SET "expiresAt" = clock_timestamp() - interval '1 second'
  `;

  const [, refreshed] = await Promise.all([
    limiter.deleteExpiredAdminLoginRateLimitBuckets(),
    limiter.consumeAdminLoginAttempt("admin@example.test")
  ]);
  assert.equal(refreshed.allowed, true);

  const rows = await buckets();
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every((row) => row.expiresAtEpochMs > BigInt(Date.now())),
    JSON.stringify(rows, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
  assert.equal(await limiter.deleteExpiredAdminLoginRateLimitBuckets(), 0);
});

test("fails closed when the shared limiter table is unavailable", async () => {
  await prisma.$executeRawUnsafe('DROP TABLE "AdminLoginRateLimitBucket"');
  const result = await limiter.consumeAdminLoginAttempt("admin@example.test");

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "unavailable");
});
