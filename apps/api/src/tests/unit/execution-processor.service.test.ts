import { DecisionStatus, ExecutionAttemptStatus, ExecutionTaskStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import { ExecutionAdapterError } from "../../modules/execution/execution-adapter.js";
import type { ExecutionAdapterRegistry } from "../../modules/execution/execution-adapter-registry.js";
import { ExecutionProcessorService } from "../../modules/execution/execution-processor.service.js";
import type { ExecutionAttemptRepository } from "../../modules/execution/execution-attempt.repository.js";
import type { ExecutionTaskWithAttempts } from "../../modules/execution/execution-task.repository.js";
import type { ExecutionTaskRepository } from "../../modules/execution/execution-task.repository.js";
import type { IdempotencyKeyRepository } from "../../modules/execution/idempotency-key.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "54c8f3cb-91c0-4429-a131-bd5d694006d0",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("ExecutionProcessorService", () => {
  it("records a retryable failure and schedules a retry", async () => {
    const attemptState = {
      id: "attempt-id",
      organizationId: "organization-id",
      executionTaskId: "execution-task-id",
      attemptNumber: 1,
      status: ExecutionAttemptStatus.running,
      startedAt: new Date("2026-03-28T00:01:00.000Z"),
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      responsePayload: null,
      createdAt: new Date("2026-03-28T00:01:00.000Z"),
    };

    const taskState: ExecutionTaskWithAttempts = {
      id: "execution-task-id",
      organizationId: "organization-id",
      decisionId: "decision-id",
      taskType: "notify_operator" as const,
      status: ExecutionTaskStatus.pending,
      targetSystem: "internal_notification" as const,
      payload: {
        decisionId: "decision-id",
        summary: "Notify operator",
      },
      requestedByUserId: "owner-id",
      requestedAt: new Date("2026-03-28T00:00:00.000Z"),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      lastError: null,
      retryCount: 0,
      nextRetryAt: null,
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      attempts: [],
    };

    const executionTaskRepository = {
      findByIdForOrganization: vi.fn(async () => taskState),
      findById: vi.fn(async () => taskState),
      markRunningIfProcessable: vi.fn(async () => {
        taskState.status = ExecutionTaskStatus.running;
        taskState.startedAt = new Date("2026-03-28T00:01:00.000Z");
        return taskState;
      }),
      updateById: vi.fn(async (_db: unknown, input: { id: string; data: Record<string, unknown> }) => {
        Object.assign(taskState, input.data);
        taskState.attempts = [attemptState];
        return taskState;
      }),
      findNextRunnable: vi.fn(),
      listByOrganization: vi.fn(),
      findByDecisionAndType: vi.fn(),
      create: vi.fn(),
    } as unknown as ExecutionTaskRepository;

    const executionAttemptRepository = {
      findLatestByTaskId: vi.fn(async () => (taskState.attempts.length > 0 ? taskState.attempts.at(-1)! : null)),
      create: vi.fn(async () => {
        taskState.attempts = [attemptState];
        return attemptState;
      }),
      updateById: vi.fn(async (_db: unknown, input: { id: string; data: Record<string, unknown> }) => {
        Object.assign(attemptState, input.data);
        return attemptState;
      }),
    } as unknown as ExecutionAttemptRepository;

    const decisionRepository = {
      findByIdForOrganization: vi.fn(async () => ({
        id: "decision-id",
        organizationId: "organization-id",
        decisionType: "allocation",
        status: taskState.status === ExecutionTaskStatus.running ? DecisionStatus.executing : DecisionStatus.execution_requested,
        automationTier: "auto_execute",
        policyId: "policy-id",
        policyVersion: 1,
        skuId: "sku-id",
        locationId: "location-id",
        supplierId: null,
        confidenceScore: null,
        proposedPayload: {},
        rationale: {},
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        reasons: [],
        scores: [],
        artifacts: [],
      })),
      updateStatusById: vi.fn(),
    } as unknown as DecisionRepository;

    const idempotencyKeyRepository = {
      findByKeyForOrganization: vi.fn().mockResolvedValue({
        id: "idempotency-id",
        organizationId: "organization-id",
        scopeType: "execution_task",
        scopeReference: { executionTaskId: "execution-task-id" },
        key: "execution_task:execution-task-id",
        status: "pending",
        responseHash: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      updateById: vi.fn(),
    } as unknown as IdempotencyKeyRepository;

    const executionAdapterRegistry = {
      getAdapter: vi.fn().mockReturnValue({
        execute: vi.fn().mockRejectedValue(
          new ExecutionAdapterError("notification_retryable", "Notification temporarily unavailable.", true),
        ),
      }),
    } as unknown as ExecutionAdapterRegistry;

    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const service = new ExecutionProcessorService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      decisionRepository,
      executionTaskRepository,
      executionAttemptRepository,
      idempotencyKeyRepository,
      executionAdapterRegistry,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as OutboxEventRepository,
      {
        measureAsync: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
        incrementCounter: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
        error: vi.fn(),
      } as unknown as AppLogger,
    );

    const result = await service.processExecutionTask(requestContext, "execution-task-id");

    expect(result.processedNow).toBe(true);
    expect(result.task.status).toBe(ExecutionTaskStatus.failed);
    expect(result.task.retryCount).toBe(1);
    expect(result.task.nextRetryAt).not.toBeNull();
    expect(result.attempt?.status).toBe(ExecutionAttemptStatus.failed);
    expect(vi.mocked(idempotencyKeyRepository.updateById)).toHaveBeenCalledTimes(1);
  });
});
