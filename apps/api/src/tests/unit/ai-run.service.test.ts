import { AiRunStatus, AiRunType, AiModelType, ModelRegistryStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { AiRunService } from "../../modules/ai/ai-run.service.js";
import type { AiRunRepository } from "../../modules/ai/ai-run.repository.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const transactionRunner: TransactionRunner = {
  run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    operation({} as Prisma.TransactionClient),
  ) as TransactionRunner["run"],
};

describe("AiRunService", () => {
  it("starts and completes an AI run with explicit status transitions", async () => {
    const aiRunRepository = {
      create: vi.fn().mockResolvedValue({
        id: "ai-run-id",
        organizationId: "organization-id",
        modelRegistryEntryId: "model-id",
        runType: AiRunType.forecast_enhancement,
        status: AiRunStatus.pending,
        subjectType: "ForecastJob",
        subjectReference: "forecast-job-id",
        inputChecksum: "checksum",
        inputPayload: { ok: true },
        outputPayload: null,
        errorMessage: null,
        latencyMs: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        completedAt: null,
        modelRegistryEntry: {
          id: "model-id",
          provider: "mock",
          modelName: "mock-forecast-enhancer",
          modelVersion: "v1",
          modelType: AiModelType.forecast_enhancement,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      }),
      updateById: vi.fn().mockResolvedValue({
        id: "ai-run-id",
        organizationId: "organization-id",
        modelRegistryEntryId: "model-id",
        runType: AiRunType.forecast_enhancement,
        status: AiRunStatus.succeeded,
        subjectType: "ForecastJob",
        subjectReference: "forecast-job-id",
        inputChecksum: "checksum",
        inputPayload: { ok: true },
        outputPayload: { enhanced: true },
        errorMessage: null,
        latencyMs: 25,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        completedAt: new Date("2026-03-28T00:00:25.000Z"),
        modelRegistryEntry: {
          id: "model-id",
          provider: "mock",
          modelName: "mock-forecast-enhancer",
          modelVersion: "v1",
          modelType: AiModelType.forecast_enhancement,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      }),
    } as unknown as AiRunRepository;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;
    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new AiRunService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      aiRunRepository,
      {
        ensureAiRunAllowedInTransaction: vi.fn().mockResolvedValue(undefined),
        recordCurrentUsageInTransaction: vi.fn().mockResolvedValue(undefined),
      } as unknown as BillingEntitlementService,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      auditEventRepository,
      outboxEventRepository,
      {
        incrementCounter: vi.fn(),
        recordDuration: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
      } as unknown as AppLogger,
    );

    const startedRun = await service.startRun({
      organizationId: "organization-id",
      actorUserId: "owner-id",
      correlationId: "corr-id",
      modelRegistryEntryId: "model-id",
      runType: AiRunType.forecast_enhancement,
      subjectType: "ForecastJob",
      subjectReference: "forecast-job-id",
      inputChecksum: "checksum",
      inputPayload: { ok: true },
    });

    const completedRun = await service.markSucceededInTransaction({} as Prisma.TransactionClient, {
      aiRunId: startedRun.id,
      organizationId: "organization-id",
      actorUserId: "owner-id",
      correlationId: "corr-id",
      outputPayload: { enhanced: true },
      latencyMs: 25,
    });

    expect(startedRun.status).toBe(AiRunStatus.pending);
    expect(completedRun.status).toBe(AiRunStatus.succeeded);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(2);
  });
});
