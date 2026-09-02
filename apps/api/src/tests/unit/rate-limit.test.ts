import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter, type RateLimitPolicy } from "../../infrastructure/http/middleware/rate-limit.js";

describe("InMemoryRateLimiter", () => {
  it("blocks requests after the configured limit and resets after the window", () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter(() => now);
    const policy: RateLimitPolicy = {
      name: "test_policy",
      maxRequests: 2,
      windowMs: 1_000,
    };

    const first = limiter.consume("tenant-a", policy);
    const second = limiter.consume("tenant-a", policy);
    const third = limiter.consume("tenant-a", policy);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(1);

    now = 1_001;
    const afterReset = limiter.consume("tenant-a", policy);
    expect(afterReset.allowed).toBe(true);
  });
});
