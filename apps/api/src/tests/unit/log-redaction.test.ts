import { describe, expect, it } from "vitest";

import { sanitizeForLogging } from "../../infrastructure/logging/log-redaction.js";

describe("sanitizeForLogging", () => {
  it("redacts sensitive keys without dropping safe context", () => {
    const value = sanitizeForLogging({
      authorization: "Bearer token",
      password: "secret-password",
      stripeSignature: "signed-value",
      nested: {
        apiKey: "top-secret",
        cookie: "session=secret",
        safe: "keep-me",
      },
    });

    expect(value).toEqual({
      authorization: "[REDACTED]",
      password: "[REDACTED]",
      stripeSignature: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        cookie: "[REDACTED]",
        safe: "keep-me",
      },
    });
  });
});
