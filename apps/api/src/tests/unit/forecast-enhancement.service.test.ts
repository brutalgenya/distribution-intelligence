import {
  AiModelType,
  AiRunStatus,
  AiRunType,
  ForecastJobStatus,
  ForecastModelType,
  ForecastScopeType,
  ModelRegistryStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { AiProviderRegistry } from "../../modules/ai/ai-provider-registry.js";
import type { AiRunService } from "../../modules/ai/ai-run.service.js";
import type { EnhancedForecastResultRepository } from "../../modules/ai/enhanced-forecast-result.repository.js";
import { ForecastEnhancementService } from "../../modules/ai/forecast-enhancement.service.js";
import { MockAiProvider } from "../../modules/ai/mock-ai.provider.js";
import type { ModelRegistryService } from "../../modules/ai/model-registry.service.js";
import type { ForecastJobRepository } from "../../modules/forecasting/forecast-job.repository.js";
import type { ForecastResultRepository } from "../../modules/forecasting/forecast-result.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "636bc566-bf95-4f6d-a79e-b90b37f58cb7",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

const transactionRunner: TransactionRunner = {
  run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    operation({} as Prisma.TransactionClient),
  ) as TransactionRunner["run"],
};

const completedForecastJob = {
  id: "forecast-job-id",
  organizationId: "organization-id",
  status: ForecastJobStatus.completed,
  requestedByUserId: "owner-id",
  scopeType: ForecastScopeType.sku_location,
  scopeReference: {
    skuId: "sku-id",
    locationId: "location-id",
  },
  horizonDays: 2,
  modelType: ForecastModelType.baseline_recent_average,
  inputSnapshot: {},
  errorMessage: null,
  createdAt: new Date("2026-03-28T00:00:00.000Z"),
  startedAt: new Date("2026-03-28T00:01:00.000Z"),
  completedAt: new Date("2026-03-28T00:02:00.000Z"),
};

const baselineResults = [
  {
    id: "result-1",
    organizationId: "organization-id",
    forecastJobId: "forecast-job-id",
    skuId: "sku-id",
    locationId: "location-id",
    forecastDate: new Date("2026-03-29T00:00:00.000Z"),
    forecastQty: 10,
    confidenceLow: 9,
    confidenceHigh: 12,
    modelType: ForecastModelType.baseline_recent_average,
    createdAt: new Date("2026-03-28T00:02:00.000Z"),
  },
];

describe("ForecastEnhancementService", () => {
  it("degrades cleanly to the baseline when the provider output fails schema validation", async () => {
    const aiRunService = {
      startRun: vi.fn().mockResolvedValue({
        id: "ai-run-id",
      }),
      markDegradedInTransaction: vi.fn().mockResolvedValue({
        id: "ai-run-id",
        organizationId: "organization-id",
        modelRegistryEntryId: "model-id",
        runType: AiRunType.forecast_enhancement,
        status: AiRunStatus.degraded,
        subjectType: "ForecastJob",
        subjectReference: "forecast-job-id",
        inputChecksum: "checksum",
        inputPayload: {},
        outputPayload: null,
        errorMessage: "invalid",
        latencyMs: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        completedAt: new Date("2026-03-28T00:00:10.000Z"),
        modelRegistryEntry: {
          id: "model-id",
          provider: "mock",
          modelName: "mock-invalid-forecast-enhancer",
          modelVersion: "v1",
          modelType: AiModelType.forecast_enhancement,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      }),
      listRuns: vi.fn(),
      getRun: vi.fn(),
      markSucceededInTransaction: vi.fn(),
    } as unknown as AiRunService;

    const service = new ForecastEnhancementService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      {
        findByIdForOrganization: vi.fn().mockResolvedValue(completedForecastJob),
      } as unknown as ForecastJobRepository,
      {
        listByJobIdForOrganization: vi.fn().mockResolvedValue(baselineResults),
      } as unknown as ForecastResultRepository,
      {
        listByJobIdAndModelRegistryEntryId: vi.fn().mockResolvedValue([]),
        deleteByJobIdAndModelRegistryEntryId: vi.fn(),
        createMany: vi.fn(),
      } as unknown as EnhancedForecastResultRepository,
      {
        findActiveModelEntry: vi.fn().mockResolvedValue({
          id: "model-id",
          provider: "mock",
          modelName: "mock-invalid-forecast-enhancer",
          modelVersion: "v1",
          modelType: AiModelType.forecast_enhancement,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        }),
      } as unknown as ModelRegistryService,
      aiRunService,
      new AiProviderRegistry([new MockAiProvider()]),
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn(),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn(),
      } as unknown as OutboxEventRepository,
    );

    const result = await service.enhanceForecastJob(requestContext, {
      forecastJobId: "forecast-job-id",
    });

    expect(result.status).toBe("degraded");
    expect(result.baselineFallbackUsed).toBe(true);
    expect(result.enhancedResults).toHaveLength(0);
  });
});
