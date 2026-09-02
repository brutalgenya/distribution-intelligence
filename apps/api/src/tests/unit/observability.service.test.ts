import { WorkerType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { AppConfig } from "../../infrastructure/config/env.js";
import { InMemoryMetricsRegistry } from "../../infrastructure/telemetry/metrics-registry.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { ObservabilityService } from "../../modules/observability/observability.service.js";

const buildConfig = (): AppConfig => ({
  APP_ENV: "test",
  NODE_ENV: "test",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
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
});

describe("ObservabilityService", () => {
  it("reports readiness and liveness with bounded public fields", async () => {
    const db = {
      $queryRaw: async () => [{ "?column?": 1 }],
    };
    const emptyWorkerRunRepository = {
      findLatestByWorkerType: async () => null,
      countByWorkerTypeAndStatus: async () => 0,
      sumProcessedCountByWorkerType: async () => ({ _sum: { processedCount: 0 } }),
    };
    const emptyForecastRepository = {
      listByOrganization: async () => [],
    };
    const emptyExecutionRepository = {
      listByOrganization: async () => [],
    };
    const emptyIntegrationSyncRepository = {
      listByOrganization: async () => [],
    };
    const authorizationService = {
      requireOrganizationPermission: async () => undefined,
    };

    const service = new ObservabilityService(
      buildConfig(),
      db as never,
      new TelemetryService(new InMemoryMetricsRegistry()),
      emptyWorkerRunRepository as never,
      emptyForecastRepository as never,
      emptyExecutionRepository as never,
      emptyIntegrationSyncRepository as never,
      authorizationService as never,
    );

    const live = service.getLiveness();
    const ready = await service.getReadiness();
    const health = await service.getHealth();

    expect(live.status).toBe("ok");
    expect(live.environment).toBe("test");
    expect(ready.status).toBe("ready");
    expect(health.status).toBe("ok");
    expect(health.readiness).toBe("ready");
  });

  it("includes the integration worker in the supported worker set", async () => {
    const db = {
      $queryRaw: async () => [{ "?column?": 1 }],
    };
    const workerRunRepository = {
      findLatestByWorkerType: async () => null,
      countByWorkerTypeAndStatus: async () => 0,
      sumProcessedCountByWorkerType: async () => ({ _sum: { processedCount: 0 } }),
    };
    const emptyRepository = {
      listByOrganization: async () => [],
    };
    const authorizationService = {
      requireOrganizationPermission: async () => undefined,
    };

    const service = new ObservabilityService(
      buildConfig(),
      db as never,
      new TelemetryService(new InMemoryMetricsRegistry()),
      workerRunRepository as never,
      emptyRepository as never,
      emptyRepository as never,
      emptyRepository as never,
      authorizationService as never,
    );

    const workerTypes = (await service.getWorkerStatus({
      correlationId: "00000000-0000-0000-0000-000000000001",
      requestId: "test-request",
      traceId: null,
      activeOrganizationId: "00000000-0000-0000-0000-000000000002",
      user: {
        id: "00000000-0000-0000-0000-000000000003",
        email: "test@example.com",
        displayName: "Test",
      },
    })).map((item) => item.workerType);

    expect(workerTypes).toContain(WorkerType.integration);
  });
});
