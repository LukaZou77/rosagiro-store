type Bucket = { count: number; resetAt: number };

// A bounded, per-process backstop, NOT a distributed/serverless rate limiter.
// Shared edge counters are configured separately in the WAF rollout.
export class LocalRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private nextSweepAt = 0;

  constructor(private readonly maxEntries = 10_000) {}

  consume(key: string, limit: number, windowMs: number, now = Date.now()) {
    if (now >= this.nextSweepAt) {
      for (const [entryKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(entryKey);
      }
      this.nextSweepAt = now + 60_000;
    }

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && this.buckets.size >= this.maxEntries) {
        // Best-effort local backstop: bounded storage must not globally deny new
        // customers during a high-cardinality flood. Shared WAF counters are
        // the durable boundary; remove the oldest local entry in O(1).
        const oldest = this.buckets.keys().next().value;
        if (oldest !== undefined) this.buckets.delete(oldest);
      }
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count = Math.min(bucket.count + 1, limit + 1);
    return {
      allowed: bucket.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
}
