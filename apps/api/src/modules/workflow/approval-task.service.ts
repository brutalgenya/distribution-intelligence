import {
  ApprovalTaskPurpose,
  ApprovalTaskStatus,
  DecisionStatus,
  OperatorOverrideType,
  type ApprovalTask,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DecisionRepository, type DecisionWithDetails } from "../decisioning/decision.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  assertApprovalTaskTransition,
  assertDecisionTransition,
  isDecisionApprovalEligible,
} from "./decision-workflow-lifecycle.js";
import { toApprovalTaskDto } from "./workflow.mappers.js";
import { workflowAuditEventTypes, workflowOutboxEventTypes } from "./workflow.constants.js";
import type { ApprovalTaskDto } from "./workflow.schemas.js";
import { ApprovalTaskRepository } from "./approval-task.repository.js";
import { OperatorOverrideService } from "./operator-override.service.js";

export interface ApprovalTaskMutationResult {
  approvalTask: ApprovalTask;
  decision: DecisionWithDetails;
  created: boolean;
}

export class ApprovalTaskService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly approvalTaskRepository: ApprovalTaskRepository,
    private readonly operatorOverrideService: OperatorOverrideService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async listApprovalTasks(
    context: RequestContext,
    filters: { status?: ApprovalTaskStatus; decisionId?: string },
  ): Promise<ApprovalTaskDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "workflow.read");

    if (filters.decisionId) {
      await this.requireDecision(this.db, organizationId, filters.decisionId);
    }

    const approvalTasks = await this.approvalTaskRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
    });

    return approvalTasks.map(toApprovalTaskDto);
  }

  public async getApprovalTask(context: RequestContext, approvalTaskId: string): Promise<ApprovalTaskDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "workflow.read");

    const approvalTask = await this.requireApprovalTask(this.db, organizationId, approvalTaskId);
    return toApprovalTaskDto(approvalTask);
  }

  public async createApprovalTaskInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      decisionId: string;
      purpose: ApprovalTaskPurpose;
      assignedToUserId?: string;
      comment?: string;
    },
  ): Promise<ApprovalTaskMutationResult> {
    let decision = await this.requireDecision(db, input.organizationId, input.decisionId);

    if (!isDecisionApprovalEligible(decision.status)) {
      throw new ConflictError("Decision is not eligible for approval.");
    }

    const existingApprovalTask = await this.approvalTaskRepository.findPendingByDecision(db, {
      organizationId: input.organizationId,
      decisionId: input.decisionId,
    });
    if (existingApprovalTask) {
      return {
        approvalTask: existingApprovalTask,
        decision,
        created: false,
      };
    }

    if (decision.status !== DecisionStatus.awaiting_approval) {
      assertDecisionTransition(decision.status, DecisionStatus.awaiting_approval);
      decision = await this.decisionRepository.updateStatusById(db, {
        id: decision.id,
        status: DecisionStatus.awaiting_approval,
      });
    }

    const approvalTask = await this.approvalTaskRepository.create(db, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      purpose: input.purpose,
      status: ApprovalTaskStatus.pending,
      requestedByUserId: input.actorUserId,
      ...(input.assignedToUserId ? { assignedToUserId: input.assignedToUserId } : {}),
      requestedAt: new Date(),
      ...(input.comment ? { comment: input.comment } : {}),
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: workflowAuditEventTypes.approvalRequested,
      entityType: "ApprovalTask",
      entityId: approvalTask.id,
      payload: {
        decisionId: decision.id,
        purpose: approvalTask.purpose,
        status: approvalTask.status,
        assignedToUserId: approvalTask.assignedToUserId,
        decisionStatus: decision.status,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: workflowOutboxEventTypes.approvalRequested,
      aggregateType: "ApprovalTask",
      aggregateId: approvalTask.id,
      payload: {
        organizationId: input.organizationId,
        approvalTaskId: approvalTask.id,
        decisionId: decision.id,
        purpose: approvalTask.purpose,
        status: approvalTask.status,
        decisionStatus: decision.status,
      },
    });

    this.telemetryService.incrementCounter("approval.task.created", 1, { organizationId: input.organizationId });
    this.logger.info(
      "Approval task requested.",
      { approvalTaskId: approvalTask.id, decisionId: decision.id, purpose: approvalTask.purpose },
      { module: "workflow", operation: "createApprovalTask", organizationId: input.organizationId },
    );

    return {
      approvalTask,
      decision,
      created: true,
    };
  }

  public async approveApprovalTaskInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      approvalTaskId: string;
      comment?: string;
    },
  ): Promise<ApprovalTaskMutationResult> {
    const approvalTask = await this.requireApprovalTask(db, input.organizationId, input.approvalTaskId);
    let decision = await this.requireDecision(db, input.organizationId, approvalTask.decisionId);

    if (approvalTask.status === ApprovalTaskStatus.approved) {
      return {
        approvalTask,
        decision,
        created: false,
      };
    }

    assertApprovalTaskTransition(approvalTask.status, ApprovalTaskStatus.approved);

    if (decision.status !== DecisionStatus.approved && decision.status !== DecisionStatus.execution_requested) {
      assertDecisionTransition(decision.status, DecisionStatus.approved);
      decision = await this.decisionRepository.updateStatusById(db, {
        id: decision.id,
        status: DecisionStatus.approved,
      });
    }

    const approvedTask = await this.approvalTaskRepository.updateById(db, {
      id: approvalTask.id,
      data: {
        status: ApprovalTaskStatus.approved,
        decidedAt: new Date(),
        decidedByUserId: input.actorUserId,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    });

    await this.operatorOverrideService.recordOverrideInTransaction(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      decisionId: decision.id,
      overrideType: OperatorOverrideType.manual_approve,
      reason: input.comment ?? "Approval task approved manually.",
      payload: {
        approvalTaskId: approvedTask.id,
        purpose: approvedTask.purpose,
      },
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: workflowAuditEventTypes.approvalApproved,
      entityType: "ApprovalTask",
      entityId: approvedTask.id,
      payload: {
        decisionId: decision.id,
        purpose: approvedTask.purpose,
        status: approvedTask.status,
        decisionStatus: decision.status,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: workflowOutboxEventTypes.approvalApproved,
      aggregateType: "ApprovalTask",
      aggregateId: approvedTask.id,
      payload: {
        organizationId: input.organizationId,
        approvalTaskId: approvedTask.id,
        decisionId: decision.id,
        purpose: approvedTask.purpose,
        status: approvedTask.status,
        decisionStatus: decision.status,
      },
    });

    this.telemetryService.incrementCounter("approval.task.approved", 1, { organizationId: input.organizationId });
    this.logger.info(
      "Approval task approved.",
      { approvalTaskId: approvedTask.id, decisionId: decision.id, purpose: approvedTask.purpose },
      { module: "workflow", operation: "approveApprovalTask", organizationId: input.organizationId },
    );

    return {
      approvalTask: approvedTask,
      decision,
      created: false,
    };
  }

  public async rejectApprovalTaskInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      approvalTaskId: string;
      comment?: string;
    },
  ): Promise<ApprovalTaskMutationResult> {
    const approvalTask = await this.requireApprovalTask(db, input.organizationId, input.approvalTaskId);
    let decision = await this.requireDecision(db, input.organizationId, approvalTask.decisionId);

    if (approvalTask.status === ApprovalTaskStatus.rejected) {
      return {
        approvalTask,
        decision,
        created: false,
      };
    }

    assertApprovalTaskTransition(approvalTask.status, ApprovalTaskStatus.rejected);

    if (decision.status !== DecisionStatus.rejected) {
      assertDecisionTransition(decision.status, DecisionStatus.rejected);
      decision = await this.decisionRepository.updateStatusById(db, {
        id: decision.id,
        status: DecisionStatus.rejected,
      });
    }

    const rejectedTask = await this.approvalTaskRepository.updateById(db, {
      id: approvalTask.id,
      data: {
        status: ApprovalTaskStatus.rejected,
        decidedAt: new Date(),
        decidedByUserId: input.actorUserId,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    });

    await this.operatorOverrideService.recordOverrideInTransaction(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      decisionId: decision.id,
      overrideType: OperatorOverrideType.manual_reject,
      reason: input.comment ?? "Approval task rejected manually.",
      payload: {
        approvalTaskId: rejectedTask.id,
        purpose: rejectedTask.purpose,
      },
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: workflowAuditEventTypes.approvalRejected,
      entityType: "ApprovalTask",
      entityId: rejectedTask.id,
      payload: {
        decisionId: decision.id,
        purpose: rejectedTask.purpose,
        status: rejectedTask.status,
        decisionStatus: decision.status,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: workflowOutboxEventTypes.approvalRejected,
      aggregateType: "ApprovalTask",
      aggregateId: rejectedTask.id,
      payload: {
        organizationId: input.organizationId,
        approvalTaskId: rejectedTask.id,
        decisionId: decision.id,
        purpose: rejectedTask.purpose,
        status: rejectedTask.status,
        decisionStatus: decision.status,
      },
    });

    this.telemetryService.incrementCounter("approval.task.rejected", 1, { organizationId: input.organizationId });
    this.logger.info(
      "Approval task rejected.",
      { approvalTaskId: rejectedTask.id, decisionId: decision.id, purpose: rejectedTask.purpose },
      { module: "workflow", operation: "rejectApprovalTask", organizationId: input.organizationId },
    );

    return {
      approvalTask: rejectedTask,
      decision,
      created: false,
    };
  }

  private async requireDecision(
    db: DbClient,
    organizationId: string,
    decisionId: string,
  ): Promise<DecisionWithDetails> {
    const decision = await this.decisionRepository.findByIdForOrganization(db, {
      organizationId,
      id: decisionId,
    });
    if (!decision) {
      throw new NotFoundError("Decision was not found.");
    }

    return decision;
  }

  private async requireApprovalTask(
    db: DbClient,
    organizationId: string,
    approvalTaskId: string,
  ): Promise<ApprovalTask> {
    const approvalTask = await this.approvalTaskRepository.findByIdForOrganization(db, {
      organizationId,
      id: approvalTaskId,
    });
    if (!approvalTask) {
      throw new NotFoundError("Approval task was not found.");
    }

    return approvalTask;
  }
}
