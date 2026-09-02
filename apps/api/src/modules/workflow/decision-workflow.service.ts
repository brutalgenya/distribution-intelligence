import {
  ApprovalTaskPurpose,
  AutomationTier,
  OperatorOverrideType,
} from "@prisma/client";
import { z } from "zod";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { toDecisionDto } from "../decisioning/decisioning.mappers.js";
import { DecisionRepository, type DecisionWithDetails } from "../decisioning/decision.repository.js";
import { toExecutionTaskDto } from "../execution/execution.mappers.js";
import type { ExecutionRequestResultDto } from "../execution/execution.schemas.js";
import { ExecutionTaskService } from "../execution/execution-task.service.js";
import { AUTO_EXECUTION_REPLENISHMENT_QTY_APPROVAL_THRESHOLD } from "./workflow.constants.js";
import { toApprovalTaskDto } from "./workflow.mappers.js";
import type {
  ApprovalTaskActionResultDto,
  ApprovalTaskDto,
  CreateApprovalTaskInput,
  DecideApprovalTaskInput,
  RequestDecisionApprovalInput,
} from "./workflow.schemas.js";
import { ApprovalTaskService } from "./approval-task.service.js";
import { OperatorOverrideService } from "./operator-override.service.js";

const replenishmentApprovalPayloadSchema = z.object({
  recommendedOrderQty: z.coerce.number().int().positive(),
});

export class DecisionWorkflowService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly approvalTaskService: ApprovalTaskService,
    private readonly executionTaskService: ExecutionTaskService,
    private readonly operatorOverrideService: OperatorOverrideService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  public async createApprovalTask(
    context: RequestContext,
    input: CreateApprovalTaskInput,
  ): Promise<ApprovalTaskDto> {
    const organizationId = requireActiveOrganizationId(context);

    const result = await this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");

      const approvalResult = await this.approvalTaskService.createApprovalTaskInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        decisionId: input.decisionId,
        purpose: input.purpose,
        ...(input.assignedToUserId ? { assignedToUserId: input.assignedToUserId } : {}),
        ...(input.comment ? { comment: input.comment } : {}),
      });

      if (approvalResult.created) {
        await this.operatorOverrideService.recordOverrideInTransaction(db, {
          organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          decisionId: input.decisionId,
          overrideType: OperatorOverrideType.manual_request_approval,
          reason: input.comment ?? "Approval requested manually.",
          payload: {
            approvalTaskId: approvalResult.approvalTask.id,
            purpose: approvalResult.approvalTask.purpose,
          },
        });
      }

      return approvalResult;
    });

    return toApprovalTaskDto(result.approvalTask);
  }

  public async requestApprovalForDecision(
    context: RequestContext,
    decisionId: string,
    input: RequestDecisionApprovalInput,
  ): Promise<ApprovalTaskDto> {
    return this.createApprovalTask(context, {
      decisionId,
      purpose: ApprovalTaskPurpose.decision_review,
      ...(input.assignedToUserId ? { assignedToUserId: input.assignedToUserId } : {}),
      ...(input.comment ? { comment: input.comment } : {}),
    });
  }

  public async requestExecutionForDecision(
    context: RequestContext,
    decisionId: string,
  ): Promise<ExecutionRequestResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");

      const decision = await this.requireDecision(db, organizationId, decisionId);
      if (this.shouldRouteToApproval(decision)) {
        const approvalResult = await this.approvalTaskService.createApprovalTaskInTransaction(db, {
          organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          decisionId,
          purpose: ApprovalTaskPurpose.execution_gate,
          comment: "Execution requested and routed to approval.",
        });

        if (approvalResult.created) {
          await this.operatorOverrideService.recordOverrideInTransaction(db, {
            organizationId,
            actorUserId: context.user.id,
            correlationId: context.correlationId,
            decisionId,
            overrideType: OperatorOverrideType.manual_request_execution,
            reason: "Execution requested manually and routed to approval.",
            payload: {
              approvalTaskId: approvalResult.approvalTask.id,
              routedToApproval: true,
            },
          });
        }

        return {
          decision: toDecisionDto(approvalResult.decision),
          approvalTask: toApprovalTaskDto(approvalResult.approvalTask),
          executionTask: null,
          routedToApproval: true,
        };
      }

      const executionResult = await this.executionTaskService.createExecutionTaskForDecisionInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        decisionId,
      });

      if (executionResult.created) {
        await this.operatorOverrideService.recordOverrideInTransaction(db, {
          organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          decisionId,
          executionTaskId: executionResult.executionTask.id,
          overrideType: OperatorOverrideType.manual_request_execution,
          reason: "Execution requested manually.",
          payload: {
            routedToApproval: false,
          },
        });
      }

      return {
        decision: toDecisionDto(executionResult.decision),
        approvalTask: null,
        executionTask: toExecutionTaskDto(executionResult.executionTask),
        routedToApproval: false,
      };
    });
  }

  public async approveApprovalTask(
    context: RequestContext,
    approvalTaskId: string,
    input: DecideApprovalTaskInput,
  ): Promise<ApprovalTaskActionResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");

      const approvalResult = await this.approvalTaskService.approveApprovalTaskInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        approvalTaskId,
        ...(input.comment ? { comment: input.comment } : {}),
      });

      let executionTask = null;
      let decision = approvalResult.decision;

      if (approvalResult.approvalTask.purpose === ApprovalTaskPurpose.execution_gate) {
        const executionResult = await this.executionTaskService.createExecutionTaskForDecisionInTransaction(db, {
          organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          decisionId: approvalResult.approvalTask.decisionId,
        });
        executionTask = executionResult.executionTask;
        decision = executionResult.decision;
      }

      return {
        approvalTask: toApprovalTaskDto(approvalResult.approvalTask),
        decision: toDecisionDto(decision),
        executionTask: executionTask ? toExecutionTaskDto(executionTask) : null,
      };
    });
  }

  public async rejectApprovalTask(
    context: RequestContext,
    approvalTaskId: string,
    input: DecideApprovalTaskInput,
  ): Promise<ApprovalTaskActionResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");

      const approvalResult = await this.approvalTaskService.rejectApprovalTaskInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        approvalTaskId,
        ...(input.comment ? { comment: input.comment } : {}),
      });

      return {
        approvalTask: toApprovalTaskDto(approvalResult.approvalTask),
        decision: toDecisionDto(approvalResult.decision),
        executionTask: null,
      };
    });
  }

  private shouldRouteToApproval(decision: DecisionWithDetails): boolean {
    if (decision.automationTier !== AutomationTier.auto_execute) {
      return true;
    }

    if (decision.decisionType === "replenishment") {
      const replenishmentPayload = replenishmentApprovalPayloadSchema.parse(decision.proposedPayload);
      return replenishmentPayload.recommendedOrderQty > AUTO_EXECUTION_REPLENISHMENT_QTY_APPROVAL_THRESHOLD;
    }

    return false;
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
}
