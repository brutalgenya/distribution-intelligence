import {
  DecisionStatus,
  DecisionType,
  OperatorOverrideType,
  type OperatorOverride,
  type Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DecisionRepository, type DecisionWithDetails } from "../decisioning/decision.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { ExecutionTaskRepository } from "../execution/execution-task.repository.js";
import { assertDecisionTransition } from "./decision-workflow-lifecycle.js";
import { toOperatorOverrideDto } from "./workflow.mappers.js";
import { workflowAuditEventTypes, workflowOutboxEventTypes } from "./workflow.constants.js";
import type {
  CreateOperatorOverrideInput,
  OperatorOverrideDto,
} from "./workflow.schemas.js";
import { OperatorOverrideRepository } from "./operator-override.repository.js";

export interface RecordOperatorOverrideInput {
  organizationId: string;
  actorUserId: string;
  correlationId: string;
  decisionId?: string;
  executionTaskId?: string;
  overrideType: OperatorOverrideType;
  reason: string;
  payload?: Prisma.InputJsonObject;
}

export interface OperatorOverrideMutationResult {
  override: OperatorOverride;
  decision: DecisionWithDetails | null;
}

export class OperatorOverrideService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly operatorOverrideRepository: OperatorOverrideRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createOverride(
    context: RequestContext,
    input: CreateOperatorOverrideInput,
  ): Promise<OperatorOverrideDto> {
    const organizationId = requireActiveOrganizationId(context);

    const result = await this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");

      return this.recordOverrideInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
        ...(input.executionTaskId ? { executionTaskId: input.executionTaskId } : {}),
        overrideType: input.overrideType,
        reason: input.reason,
        ...(input.payload ? { payload: input.payload } : {}),
      });
    });

    return toOperatorOverrideDto(result.override);
  }

  public async listOverrides(
    context: RequestContext,
    filters: {
      decisionId?: string;
      executionTaskId?: string;
      overrideType?: OperatorOverrideType;
    },
  ): Promise<OperatorOverrideDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "workflow.read");

    if (filters.decisionId) {
      await this.requireDecision(this.db, organizationId, filters.decisionId);
    }

    if (filters.executionTaskId) {
      await this.requireExecutionTask(this.db, organizationId, filters.executionTaskId);
    }

    const overrides = await this.operatorOverrideRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
      ...(filters.executionTaskId ? { executionTaskId: filters.executionTaskId } : {}),
      ...(filters.overrideType ? { overrideType: filters.overrideType } : {}),
    });

    return overrides.map(toOperatorOverrideDto);
  }

  public async recordOverrideInTransaction(
    db: DbClient,
    input: RecordOperatorOverrideInput,
  ): Promise<OperatorOverrideMutationResult> {
    let decision: DecisionWithDetails | null = null;

    if (input.decisionId) {
      decision = await this.requireDecision(db, input.organizationId, input.decisionId);
    }

    if (input.executionTaskId) {
      await this.requireExecutionTask(db, input.organizationId, input.executionTaskId);
    }

    if (input.overrideType === OperatorOverrideType.manual_close_exception) {
      if (!decision) {
        throw new ConflictError("manual_close_exception requires a decision.");
      }

      if (decision.decisionType !== DecisionType.exception) {
        throw new ConflictError("manual_close_exception can only be used for exception decisions.");
      }

      if (decision.status !== DecisionStatus.dismissed) {
        assertDecisionTransition(decision.status, DecisionStatus.dismissed);
        decision = await this.decisionRepository.updateStatusById(db, {
          id: decision.id,
          status: DecisionStatus.dismissed,
        });
      }
    }

    const override = await this.operatorOverrideRepository.create(db, {
      organizationId: input.organizationId,
      ...(input.decisionId ? { decisionId: input.decisionId } : {}),
      ...(input.executionTaskId ? { executionTaskId: input.executionTaskId } : {}),
      overrideType: input.overrideType,
      reason: input.reason,
      ...(input.payload ? { payload: input.payload } : {}),
      createdByUserId: input.actorUserId,
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: workflowAuditEventTypes.overrideRecorded,
      entityType: "OperatorOverride",
      entityId: override.id,
      payload: {
        decisionId: override.decisionId,
        executionTaskId: override.executionTaskId,
        overrideType: override.overrideType,
        reason: override.reason,
        decisionStatus: decision?.status ?? null,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: workflowOutboxEventTypes.overrideRecorded,
      aggregateType: "OperatorOverride",
      aggregateId: override.id,
      payload: {
        organizationId: input.organizationId,
        operatorOverrideId: override.id,
        decisionId: override.decisionId,
        executionTaskId: override.executionTaskId,
        overrideType: override.overrideType,
        decisionStatus: decision?.status ?? null,
      },
    });

    return {
      override,
      decision,
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

  private async requireExecutionTask(db: DbClient, organizationId: string, executionTaskId: string) {
    const executionTask = await this.executionTaskRepository.findByIdForOrganization(db, {
      organizationId,
      id: executionTaskId,
    });
    if (!executionTask) {
      throw new NotFoundError("Execution task was not found.");
    }

    return executionTask;
  }
}
