import assert from "node:assert/strict";
import { test } from "node:test";
import { LocalRateLimiter } from "./local-rate-limit";
import { requestClientIp } from "./request-client-ip";

test("local backstop permits the limit, rejects overflow, and resets after expiry", () => {
  const limiter = new LocalRateLimiter();
  assert.equal(limiter.consume("a", 2, 60_000, 0).allowed, true);
  assert.equal(limiter.consume("a", 2, 60_000, 0).allowed, true);
  assert.deepEqual(limiter.consume("a", 2, 60_000, 30_000), { allowed: false, retryAfterSeconds: 30 });
  assert.equal(limiter.consume("b", 2, 60_000, 30_000).allowed, true);
  assert.equal(limiter.consume("a", 2, 60_000, 60_000).allowed, true);
});

test("bucket storage remains bounded without globally blocking new clients", () => {
  const limiter = new LocalRateLimiter(2);
  limiter.consume("a", 1, 60_000, 0);
  limiter.consume("b", 1, 60_000, 0);
  assert.equal(limiter.consume("c", 1, 60_000, 0).allowed, true);
  assert.equal(limiter.consume("b", 1, 60_000, 0).allowed, false);
  assert.equal(limiter.consume("c", 1, 60_000, 60_000).allowed, true);
});

test("Vercel IP is prioritized and malformed/chained values cannot mint buckets", () => {
  assert.equal(requestClientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }), true), "203.0.113.7");
  assert.equal(requestClientIp(new Headers({ "x-forwarded-for": "2001:DB8::1" }), true), "2001:db8::1");
  assert.equal(requestClientIp(new Headers({ "x-forwarded-for": "2001:0db8:0:0:0:0:0:1" }), true), "2001:db8::1");
  for (const value of ["random-key", "203.0.113.7, 1.2.3.4", "", "999.0.0.1"]) {
    assert.equal(requestClientIp(new Headers({ "x-forwarded-for": value }), true), "unknown");
  }
});
