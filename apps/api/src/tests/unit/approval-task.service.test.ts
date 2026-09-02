import {
  ApprovalTaskPurpose,
  ApprovalTaskStatus,
  DecisionStatus,
  DecisionType,
  Prisma,
  type AutomationTier,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import { ApprovalTaskService } from "../../modules/workflow/approval-task.service.js";
import type { ApprovalTaskRepository } from "../../modules/workflow/approval-task.repository.js";
import type { OperatorOverrideService } from "../../modules/workflow/operator-override.service.js";
import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "2d9d2bc2-c257-4934-a12e-51ad6f54a2b3",
  activeOrganizationId: "organization-id",
  user: {
    id: "operator-id",
    email: "operator@example.com",
    displayName: "Operator",
  },
};

const buildDecision = (status: DecisionStatus) => ({
  id: "decision-id",
  organizationId: "organization-id",
  decisionType: DecisionType.replenishment,
  status,
  automationTier: "recommend" as AutomationTier,
  policyId: "policy-id",
  policyVersion: 1,
  skuId: "sku-id",
  locationId: "location-id",
  supplierId: "supplier-id",
  confidenceScore: null,
  proposedPayload: { recommendedOrderQty: 12 },
  rationale: { basis: "test" },
  createdByUserId: "operator-id",
  createdAt: new Date("2026-03-28T00:00:00.000Z"),
  updatedAt: new Date("2026-03-28T00:00:00.000Z"),
  reasons: [],
  scores: [],
  artifacts: [],
});

describe("ApprovalTaskService", () => {
  it("creates a single pending approval task per decision", async () => {
    const decisionRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue(buildDecision(DecisionStatus.proposed)),
      updateStatusById: vi.fn().mockResolvedValue(buildDecision(DecisionStatus.awaiting_approval)),
    } as unknown as DecisionRepository;

    const approvalTaskRepository = {
      findPendingByDecision: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: "approval-id",
        organizationId: "organization-id",
        decisionId: "decision-id",
        purpose: ApprovalTaskPurpose.decision_review,
        status: ApprovalTaskStatus.pending,
        requestedByUserId: "operator-id",
        assignedToUserId: null,
        requestedAt: new Date("2026-03-28T00:01:00.000Z"),
        decidedAt: null,
        decidedByUserId: null,
        comment: null,
        createdAt: new Date("2026-03-28T00:01:00.000Z"),
        updatedAt: new Date("2026-03-28T00:01:00.000Z"),
      }),
      create: vi.fn().mockResolvedValue({
        id: "approval-id",
        organizationId: "organization-id",
        decisionId: "decision-id",
        purpose: ApprovalTaskPurpose.decision_review,
        status: ApprovalTaskStatus.pending,
        requestedByUserId: "operator-id",
        assignedToUserId: null,
        requestedAt: new Date("2026-03-28T00:01:00.000Z"),
        decidedAt: null,
        decidedByUserId: null,
        comment: null,
        createdAt: new Date("2026-03-28T00:01:00.000Z"),
        updatedAt: new Date("2026-03-28T00:01:00.000Z"),
      }),
      listByOrganization: vi.fn(),
      findByIdForOrganization: vi.fn(),
      updateById: vi.fn(),
    } as unknown as ApprovalTaskRepository;

    const service = new ApprovalTaskService(
      {} as Prisma.TransactionClient,
      { run: vi.fn() } as unknown as TransactionRunner,
      decisionRepository,
      approvalTaskRepository,
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
      {
        incrementCounter: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
      } as unknown as AppLogger,
    );

    const result = await service.createApprovalTaskInTransaction({} as Prisma.TransactionClient, {
      organizationId: "organization-id",
      actorUserId: "operator-id",
      correlationId: requestContext.correlationId,
      decisionId: "decision-id",
      purpose: ApprovalTaskPurpose.decision_review,
    });

    expect(result.created).toBe(true);
    expect(result.approvalTask.id).toBe("approval-id");
    expect(vi.mocked(decisionRepository.updateStatusById)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "decision-id",
        status: DecisionStatus.awaiting_approval,
      }),
    );
  });

  it("approves a pending task and transitions the decision", async () => {
    const approvalTask = {
      id: "approval-id",
      organizationId: "organization-id",
      decisionId: "decision-id",
      purpose: ApprovalTaskPurpose.execution_gate,
      status: ApprovalTaskStatus.pending,
      requestedByUserId: "operator-id",
      assignedToUserId: null,
      requestedAt: new Date("2026-03-28T00:01:00.000Z"),
      decidedAt: null,
      decidedByUserId: null,
      comment: null,
      createdAt: new Date("2026-03-28T00:01:00.000Z"),
      updatedAt: new Date("2026-03-28T00:01:00.000Z"),
    };

    const decisionRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue(buildDecision(DecisionStatus.awaiting_approval)),
      updateStatusById: vi.fn().mockResolvedValue(buildDecision(DecisionStatus.approved)),
    } as unknown as DecisionRepository;

    const approvalTaskRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue(approvalTask),
      updateById: vi.fn().mockResolvedValue({
        ...approvalTask,
        status: ApprovalTaskStatus.approved,
        decidedAt: new Date("2026-03-28T00:02:00.000Z"),
        decidedByUserId: "operator-id",
      }),
      listByOrganization: vi.fn(),
      findPendingByDecision: vi.fn(),
      create: vi.fn(),
    } as unknown as ApprovalTaskRepository;

    const operatorOverrideService = {
      recordOverrideInTransaction: vi.fn().mockResolvedValue(undefined),
    } as unknown as OperatorOverrideService;

    const service = new ApprovalTaskService(
      {} as Prisma.TransactionClient,
      { run: vi.fn() } as unknown as TransactionRunner,
      decisionRepository,
      approvalTaskRepository,
      operatorOverrideService,
      {
        requireOrganizationPermission: vi.fn(),
      } as unknown as AuthorizationService,
      {
        create: vi.fn(),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn(),
      } as unknown as OutboxEventRepository,
      {
        incrementCounter: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
      } as unknown as AppLogger,
    );

    const result = await service.approveApprovalTaskInTransaction({} as Prisma.TransactionClient, {
      organizationId: "organization-id",
      actorUserId: "operator-id",
      correlationId: requestContext.correlationId,
      approvalTaskId: "approval-id",
      comment: "Looks good",
    });

    expect(result.approvalTask.status).toBe(ApprovalTaskStatus.approved);
    expect(result.decision.status).toBe(DecisionStatus.approved);
    expect(vi.mocked(operatorOverrideService.recordOverrideInTransaction)).toHaveBeenCalledTimes(1);
  });
});
