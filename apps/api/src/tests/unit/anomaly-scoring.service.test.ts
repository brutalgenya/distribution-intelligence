import {
  AiModelType,
  AiRunStatus,
  AiRunType,
  ModelRegistryStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { AiProviderRegistry } from "../../modules/ai/ai-provider-registry.js";
import type { AiRunService } from "../../modules/ai/ai-run.service.js";
import type { AnomalyScoreRepository } from "../../modules/ai/anomaly-score.repository.js";
import { AnomalyScoringService } from "../../modules/ai/anomaly-scoring.service.js";
import { MockAiProvider } from "../../modules/ai/mock-ai.provider.js";
import type { ModelRegistryService } from "../../modules/ai/model-registry.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { DemandSignalRepository } from "../../modules/demand/demand-signal.repository.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "24f743ef-2c3b-4699-bf9b-251f6c8dcd5d",
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

describe("AnomalyScoringService", () => {
  it("scores and persists an advisory anomaly with model metadata", async () => {
    const aiRunService = {
      startRun: vi.fn().mockResolvedValue({
        id: "ai-run-id",
      }),
      markSucceededInTransaction: vi.fn().mockResolvedValue({
        id: "ai-run-id",
        organizationId: "organization-id",
        modelRegistryEntryId: "model-id",
        runType: AiRunType.anomaly_scoring,
        status: AiRunStatus.succeeded,
        subjectType: "AnomalyScope",
        subjectReference: "sku:scope",
        inputChecksum: "checksum",
        inputPayload: {},
        outputPayload: { anomalyScore: 0.5 },
        errorMessage: null,
        latencyMs: 20,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        completedAt: new Date("2026-03-28T00:00:20.000Z"),
        modelRegistryEntry: {
          id: "model-id",
          provider: "mock",
          modelName: "mock-anomaly-scorer",
          modelVersion: "v1",
          modelType: AiModelType.anomaly_scoring,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      }),
      markFailedInTransaction: vi.fn(),
    } as unknown as AiRunService;

    const persistedScore = {
      id: "anomaly-id",
      organizationId: "organization-id",
      aiRunId: "ai-run-id",
      modelRegistryEntryId: "model-id",
      subjectType: "sku_location",
      subjectReference: "sku-id:location-id",
      measurementWindowStart: new Date("2026-03-28T00:00:00.000Z"),
      measurementWindowEnd: new Date("2026-03-29T00:00:00.000Z"),
      anomalyScore: 0.5,
      severity: "medium",
      explanationSummary: "Current demand is elevated.",
      payload: { factors: [] },
      createdAt: new Date("2026-03-29T00:00:00.000Z"),
      updatedAt: new Date("2026-03-29T00:00:00.000Z"),
      modelRegistryEntry: {
        id: "model-id",
        provider: "mock",
        modelName: "mock-anomaly-scorer",
        modelVersion: "v1",
        modelType: AiModelType.anomaly_scoring,
        promptVersion: null,
        schemaVersion: "2026-03-28",
        status: ModelRegistryStatus.active,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      },
      aiRun: {
        id: "ai-run-id",
        organizationId: "organization-id",
        modelRegistryEntryId: "model-id",
        runType: AiRunType.anomaly_scoring,
        status: AiRunStatus.succeeded,
        subjectType: "AnomalyScope",
        subjectReference: "sku:scope",
        inputChecksum: "checksum",
        inputPayload: {},
        outputPayload: { anomalyScore: 0.5 },
        errorMessage: null,
        latencyMs: 20,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        completedAt: new Date("2026-03-28T00:00:20.000Z"),
        modelRegistryEntry: {
          id: "model-id",
          provider: "mock",
          modelName: "mock-anomaly-scorer",
          modelVersion: "v1",
          modelType: AiModelType.anomaly_scoring,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      },
    };

    const service = new AnomalyScoringService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      {
        findByIdForOrganization: vi.fn().mockResolvedValue({ id: "sku-id" }),
      } as unknown as SkuRepository,
      {
        findByIdForOrganization: vi.fn().mockResolvedValue({ id: "location-id" }),
      } as unknown as LocationRepository,
      {
        listByOrganization: vi
          .fn()
          .mockResolvedValueOnce([{ quantity: 10 }, { quantity: 8 }])
          .mockResolvedValueOnce([{ quantity: 4 }]),
      } as unknown as DemandSignalRepository,
      {
        findByScope: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(persistedScore),
        listByOrganization: vi.fn(),
        findByIdForOrganization: vi.fn(),
      } as unknown as AnomalyScoreRepository,
      {
        findActiveModelEntry: vi.fn().mockResolvedValue({
          id: "model-id",
          provider: "mock",
          modelName: "mock-anomaly-scorer",
          modelVersion: "v1",
          modelType: AiModelType.anomaly_scoring,
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

    const result = await service.scoreAnomaly(requestContext, {
      measurementWindowStart: "2026-03-28T00:00:00.000Z",
      measurementWindowEnd: "2026-03-29T00:00:00.000Z",
      skuId: "sku-id",
      locationId: "location-id",
    });

    expect(result.status).toBe("succeeded");
    expect(result.anomalyScore?.provider).toBe("mock");
    expect(result.anomalyScore?.modelName).toBe("mock-anomaly-scorer");
  });
});
