import type { AppConfig } from "../../infrastructure/config/env.js";

export const getTestDatabaseUrl = (): string => {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Set TEST_DATABASE_URL or DATABASE_URL to run integration tests.");
  }

  return url;
};

export const buildTestConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  APP_ENV: "test",
  NODE_ENV: "test",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL: getTestDatabaseUrl(),
  TEST_DATABASE_URL: getTestDatabaseUrl(),
  DEFAULT_INVITATION_TTL_HOURS: 24,
  DEFAULT_TRIAL_PERIOD_DAYS: 14,
  BILLING_PROVIDER: "mock",
  APP_BASE_URL: "http://localhost:4000",
  BILLING_CHECKOUT_SUCCESS_URL: "http://localhost:4000/billing/success",
  BILLING_CHECKOUT_CANCEL_URL: "http://localhost:4000/billing/cancel",
  BILLING_PORTAL_RETURN_URL: "http://localhost:4000/settings/billing",
  STRIPE_API_BASE_URL: "https://api.stripe.com",
  HTTP_BODY_LIMIT_BYTES: 262_144,
  HTTP_REQUEST_TIMEOUT_MS: 30_000,
  HTTP_CONNECTION_TIMEOUT_MS: 10_000,
  HTTP_KEEP_ALIVE_TIMEOUT_MS: 72_000,
  EXTERNAL_REQUEST_TIMEOUT_MS: 10_000,
  BILLING_WEBHOOK_MAX_BYTES: 65_536,
  RATE_LIMIT_ENABLED: true,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_BILLING_MUTATIONS: 50,
  RATE_LIMIT_AI_MUTATIONS: 50,
  RATE_LIMIT_SYNC_MUTATIONS: 50,
  RATE_LIMIT_EXECUTION_MUTATIONS: 50,
  RATE_LIMIT_SUPPORT_MUTATIONS: 50,
  RATE_LIMIT_OUTCOME_MUTATIONS: 50,
  RATE_LIMIT_FORECAST_MUTATIONS: 50,
  SUPPORT_MAX_MEASUREMENT_WINDOW_DAYS: 90,
  DEMO_BOOTSTRAP_ENABLED: true,
  ...overrides,
});
