import { describe, expect, it } from "vitest";

import { loadConfig } from "../../infrastructure/config/env.js";

const validLocalEnv = {
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "4000",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wholesale_ai_platform",
  BILLING_PROVIDER: "mock",
  APP_BASE_URL: "http://localhost:4000",
  BILLING_CHECKOUT_SUCCESS_URL: "http://localhost:4000/billing/success",
  BILLING_CHECKOUT_CANCEL_URL: "http://localhost:4000/billing/cancel",
  BILLING_PORTAL_RETURN_URL: "http://localhost:4000/settings/billing",
  STRIPE_API_BASE_URL: "https://api.stripe.com",
} satisfies Record<string, string>;

describe("loadConfig", () => {
  it("parses a valid local configuration", () => {
    const config = loadConfig(validLocalEnv);

    expect(config.APP_ENV).toBe("local");
    expect(config.BILLING_PROVIDER).toBe("mock");
    expect(config.HTTP_BODY_LIMIT_BYTES).toBeGreaterThan(0);
  });

  it("fails fast when production billing is left on mock mode", () => {
    expect(() =>
      loadConfig({
        ...validLocalEnv,
        APP_ENV: "production",
        NODE_ENV: "production",
        APP_BASE_URL: "https://api.example.com",
        BILLING_CHECKOUT_SUCCESS_URL: "https://app.example.com/billing/success",
        BILLING_CHECKOUT_CANCEL_URL: "https://app.example.com/billing/cancel",
        BILLING_PORTAL_RETURN_URL: "https://app.example.com/settings/billing",
      }),
    ).toThrowError(/BILLING_PROVIDER=stripe/i);
  });

  it("requires Stripe secrets when Stripe billing is enabled", () => {
    expect(() =>
      loadConfig({
        ...validLocalEnv,
        APP_ENV: "staging",
        NODE_ENV: "production",
        BILLING_PROVIDER: "stripe",
        APP_BASE_URL: "https://staging-api.example.com",
        BILLING_CHECKOUT_SUCCESS_URL: "https://staging.example.com/billing/success",
        BILLING_CHECKOUT_CANCEL_URL: "https://staging.example.com/billing/cancel",
        BILLING_PORTAL_RETURN_URL: "https://staging.example.com/settings/billing",
      }),
    ).toThrowError(/STRIPE_SECRET_KEY/i);
  });
});
