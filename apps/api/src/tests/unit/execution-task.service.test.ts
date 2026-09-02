import {
  DecisionStatus,
  DecisionType,
  ExecutionTaskStatus,
  Prisma,
  type AutomationTier,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import { ExecutionTaskService } from "../../modules/execution/execution-task.service.js";
import type { ExecutionTaskRepository } from "../../modules/execution/execution-task.repository.js";
import type { IdempotencyKeyRepository } from "../../modules/execution/idempotency-key.repository.js";
import type { OperatorOverrideService } from "../../modules/workflow/operator-override.service.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const buildDecision = () => ({
  id: "decision-id",
  organizationId: "organization-id",
  decisionType: DecisionType.replenishment,
  status: DecisionStatus.approved,
  automationTier: "auto_execute" as AutomationTier,
  policyId: "policy-id",
  policyVersion: 1,
  skuId: "11111111-1111-4111-8111-111111111111",
  locationId: "22222222-2222-4222-8222-222222222222",
  supplierId: "33333333-3333-4333-8333-333333333333",
  confidenceScore: null,
    proposedPayload: {
    skuId: "11111111-1111-4111-8111-111111111111",
    locationId: "22222222-2222-4222-8222-222222222222",
    supplierId: "33333333-3333-4333-8333-333333333333",
    recommendedOrderQty: 24,
    unitOfMeasure: "each",
    expectedLeadTimeDays: 7,
    projectedDaysOfCover: 4,
    projectedShortfallQty: 24,
    basisDate: "2026-03-28T00:00:00.000Z",
    recommendationType: "replenishment",
  },
  rationale: { basis: "forecast" },
  createdByUserId: "owner-id",
  createdAt: new Date("2026-03-28T00:00:00.000Z"),
  updatedAt: new Date("2026-03-28T00:00:00.000Z"),
  reasons: [{ id: "reason-id", decisionId: "decision-id", code: "forecast_exceeds_available_supply", message: "Demand exceeds ATP", createdAt: new Date("2026-03-28T00:00:00.000Z") }],
  scores: [],
  artifacts: [],
});

describe("ExecutionTaskService", () => {
  it("creates an execution task and idempotency key for approved replenishment decisions", async () => {
    const decisionRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue(buildDecision()),
      updateStatusById: vi.fn().mockResolvedValue({
        ...buildDecision(),
        status: DecisionStatus.execution_requested,
      }),
    } as unknown as DecisionRepository;

    const executionTaskRepository = {
      findByDecisionAndType: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "execution-task-id",
        organizationId: "organization-id",
        decisionId: "decision-id",
        taskType: "create_purchase_order",
        status: ExecutionTaskStatus.pending,
        targetSystem: "internal_supply",
        payload: {},
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
      }),
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "execution-task-id",
        organizationId: "organization-id",
        decisionId: "decision-id",
        taskType: "create_purchase_order",
        status: ExecutionTaskStatus.pending,
        targetSystem: "internal_supply",
        payload: {
          decisionId: "decision-id",
          recommendedOrderQty: 24,
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
      }),
      listByOrganization: vi.fn(),
      updateById: vi.fn(),
    } as unknown as ExecutionTaskRepository;

    const idempotencyKeyRepository = {
      findByKeyForOrganization: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(undefined),
      updateById: vi.fn(),
    } as unknown as IdempotencyKeyRepository;

    const service = new ExecutionTaskService(
      {} as Prisma.TransactionClient,
      { run: vi.fn() } as unknown as TransactionRunner,
      decisionRepository,
      executionTaskRepository,
      idempotencyKeyRepository,
      {
        recordOverrideInTransaction: vi.fn(),
      } as unknown as OperatorOverrideService,
      {
        requireOrganizationPermission: vi.fn(),
      } as unknown as AuthorizationService,
      {
        create: vi.fn(),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn(),
      } as unknown as OutboxEventRepository,
    );

    const result = await service.createExecutionTaskForDecisionInTransaction({} as Prisma.TransactionClient, {
      organizationId: "organization-id",
      actorUserId: "owner-id",
      correlationId: "db197d54-d04a-4422-b8e6-1f8be81f4997",
      decisionId: "decision-id",
    });

    expect(result.created).toBe(true);
    expect(result.executionTask.taskType).toBe("create_purchase_order");
    expect(vi.mocked(idempotencyKeyRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(decisionRepository.updateStatusById)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "decision-id",
        status: DecisionStatus.execution_requested,
      }),
    );
  });
});
