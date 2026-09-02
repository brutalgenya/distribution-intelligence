import { DecisionStatus, DecisionType, OperatorOverrideType, Prisma, type AutomationTier } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { OperatorOverrideService } from "../../modules/workflow/operator-override.service.js";
import type { DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import type { ExecutionTaskRepository } from "../../modules/execution/execution-task.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { OperatorOverrideRepository } from "../../modules/workflow/operator-override.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "bcc5d539-5877-4567-b69c-39cb81afbf12",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

const exceptionDecision = {
  id: "decision-id",
  organizationId: "organization-id",
  decisionType: DecisionType.exception,
  status: DecisionStatus.proposed,
  automationTier: "observe" as AutomationTier,
  policyId: "policy-id",
  policyVersion: 1,
  skuId: "sku-id",
  locationId: "location-id",
  supplierId: null,
  confidenceScore: null,
  proposedPayload: { recommendationType: "exception" },
  rationale: { reason: "missing supplier" },
  createdByUserId: "owner-id",
  createdAt: new Date("2026-03-28T00:00:00.000Z"),
  updatedAt: new Date("2026-03-28T00:00:00.000Z"),
  reasons: [],
  scores: [],
  artifacts: [],
};

describe("OperatorOverrideService", () => {
  it("records a manual close override and dismisses exception decisions", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const decisionRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue(exceptionDecision),
      updateStatusById: vi.fn().mockResolvedValue({
        ...exceptionDecision,
        status: DecisionStatus.dismissed,
      }),
    } as unknown as DecisionRepository;

    const executionTaskRepository = {
      findByIdForOrganization: vi.fn(),
    } as unknown as ExecutionTaskRepository;

    const operatorOverrideRepository = {
      create: vi.fn().mockResolvedValue({
        id: "override-id",
        organizationId: "organization-id",
        decisionId: "decision-id",
        executionTaskId: null,
        overrideType: OperatorOverrideType.manual_close_exception,
        reason: "Closed by operator",
        payload: null,
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:05:00.000Z"),
      }),
      listByOrganization: vi.fn(),
    } as unknown as OperatorOverrideRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new OperatorOverrideService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      decisionRepository,
      executionTaskRepository,
      operatorOverrideRepository,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createOverride(requestContext, {
      decisionId: "decision-id",
      overrideType: OperatorOverrideType.manual_close_exception,
      reason: "Closed by operator",
    });

    expect(result.overrideType).toBe(OperatorOverrideType.manual_close_exception);
    expect(vi.mocked(decisionRepository.updateStatusById)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "decision-id",
        status: DecisionStatus.dismissed,
      }),
    );
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
