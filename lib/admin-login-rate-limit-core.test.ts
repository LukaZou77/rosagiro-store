import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_LOGIN_IP_EMAIL_LIMIT,
  ADMIN_LOGIN_IP_LIMIT,
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  type AdminLoginAttemptStore,
  type AdminLoginCounterReceipt,
  clearSuccessfulAdminLoginAttemptCore,
  consumeAdminLoginAttemptCore
} from "./admin-login-rate-limit-core";

class MemoryStore implements AdminLoginAttemptStore {
  readonly buckets = new Map<string, AdminLoginCounterReceipt>();
  readonly expiresAtEpochMs = BigInt(Date.now() + ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1_000);
  unavailable = false;

  private consumeOne(scope: string, keyHash: string, limit: number) {
    const key = `${scope}:${keyHash}`;
    const previous = this.buckets.get(key);
    const receipt: AdminLoginCounterReceipt = {
      scope,
      keyHash,
      attempts: Math.min(previous?.attempts || 0, limit) + 1,
      revision: (previous?.revision || 0n) + 1n,
      expiresAtEpochMs: this.expiresAtEpochMs
    };
    this.buckets.set(key, receipt);
    return receipt;
  }

  async consume(input: Parameters<AdminLoginAttemptStore["consume"]>[0]) {
    if (this.unavailable) throw new Error("database details must not escape");
    const ip = this.consumeOne(input.ipScope, input.ipKeyHash, input.ipLimit);
    const ipEmail = ip.attempts <= input.ipLimit
      ? this.consumeOne(input.ipEmailScope, input.ipEmailKeyHash, input.ipEmailLimit)
      : undefined;
    return { ip, ipEmail };
  }

  async clearIfUnchanged(receipt: AdminLoginCounterReceipt) {
    const key = `${receipt.scope}:${receipt.keyHash}`;
    const current = this.buckets.get(key);
    if (
      current?.revision !== receipt.revision ||
      current.expiresAtEpochMs !== receipt.expiresAtEpochMs
    ) {
      return false;
    }
    return this.buckets.delete(key);
  }
}

const baseInput = {
  secret: "test-session-secret",
  clientIp: "203.0.113.10",
  email: "Admin@RosaGiro.com.br"
};

test("allows eight IP/email attempts and rejects the ninth", async () => {
  const store = new MemoryStore();
  for (let attempt = 1; attempt <= ADMIN_LOGIN_IP_EMAIL_LIMIT; attempt += 1) {
    const result = await consumeAdminLoginAttemptCore({ store, ...baseInput });
    assert.equal(result.allowed, true, `attempt ${attempt}`);
  }

  const blocked = await consumeAdminLoginAttemptCore({ store, ...baseInput });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "ip-email");
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("does not over-admit concurrent attempts for one IP/email bucket", async () => {
  const store = new MemoryStore();
  const results = await Promise.all(
    Array.from({ length: 16 }, () => consumeAdminLoginAttemptCore({ store, ...baseInput }))
  );

  assert.equal(results.filter((result) => result.allowed).length, ADMIN_LOGIN_IP_EMAIL_LIMIT);
  assert.equal(results.filter((result) => !result.allowed).length, 8);
});

test("stops creating email buckets after the wider IP ceiling", async () => {
  const store = new MemoryStore();
  for (let attempt = 1; attempt <= ADMIN_LOGIN_IP_LIMIT; attempt += 1) {
    await consumeAdminLoginAttemptCore({
      store,
      ...baseInput,
      email: `admin-${attempt}@example.com`
    });
  }
  const sizeAtLimit = store.buckets.size;

  const blocked = await consumeAdminLoginAttemptCore({
    store,
    ...baseInput,
    email: "new-address@example.com"
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "ip");
  assert.equal(store.buckets.size, sizeAtLimit);
});

test("uses domain-separated hashes and never stores the raw IP or email", async () => {
  const store = new MemoryStore();
  await consumeAdminLoginAttemptCore({ store, ...baseInput });
  const receipts = [...store.buckets.values()];

  assert.equal(receipts.length, 2);
  assert.notEqual(receipts[0].keyHash, receipts[1].keyHash);
  for (const receipt of receipts) {
    assert.match(receipt.keyHash, /^[a-f0-9]{64}$/);
    assert.equal(receipt.keyHash.includes(baseInput.clientIp), false);
    assert.equal(receipt.keyHash.includes(baseInput.email.toLowerCase()), false);
  }
});

test("clears only the unchanged successful combo receipt and keeps the IP bucket", async () => {
  const store = new MemoryStore();
  const admitted = await consumeAdminLoginAttemptCore({ store, ...baseInput });
  assert.equal(admitted.allowed, true);
  assert.equal(await clearSuccessfulAdminLoginAttemptCore({ store, receipt: admitted.ipEmailReceipt }), true);
  assert.equal(store.buckets.size, 1);
});

test("does not erase a newer concurrent combo attempt", async () => {
  const store = new MemoryStore();
  const first = await consumeAdminLoginAttemptCore({ store, ...baseInput });
  assert.equal(first.allowed, true);
  await consumeAdminLoginAttemptCore({ store, ...baseInput });

  assert.equal(await clearSuccessfulAdminLoginAttemptCore({ store, receipt: first.ipEmailReceipt }), false);
  assert.equal(store.buckets.size, 2);
});

test("fails closed without exposing store errors", async () => {
  const store = new MemoryStore();
  store.unavailable = true;
  let unavailableEvents = 0;
  const result = await consumeAdminLoginAttemptCore({
    store,
    ...baseInput,
    onUnavailable: () => {
      unavailableEvents += 1;
    }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "unavailable");
  assert.equal(result.retryAfterSeconds, ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  assert.equal(unavailableEvents, 1);
});

test("fails closed when SESSION_SECRET is missing", async () => {
  const store = new MemoryStore();
  const result = await consumeAdminLoginAttemptCore({ store, ...baseInput, secret: "" });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "unavailable");
  assert.equal(store.buckets.size, 0);
});

test("fails closed on a malformed database receipt", async () => {
  const malformedStore: AdminLoginAttemptStore = {
    async consume() {
      return {
        ip: {
          scope: "wrong",
          keyHash: "not-a-valid-hash",
          attempts: Number.NaN,
          revision: 0n,
          expiresAtEpochMs: 0n
        }
      };
    },
    async clearIfUnchanged() {
      return false;
    }
  };
  const result = await consumeAdminLoginAttemptCore({ store: malformedStore, ...baseInput });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "unavailable");
});

test("counts an unknown development IP conservatively instead of bypassing", async () => {
  const store = new MemoryStore();
  const result = await consumeAdminLoginAttemptCore({
    store,
    ...baseInput,
    clientIp: "unknown"
  });

  assert.equal(result.allowed, true);
  assert.equal(store.buckets.size, 2);
});
