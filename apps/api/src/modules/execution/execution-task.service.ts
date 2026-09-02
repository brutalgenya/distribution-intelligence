import {
  DecisionStatus,
  ExecutionTaskStatus,
  IdempotencyKeyStatus,
  IdempotencyScopeType,
  OperatorOverrideType,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DecisionRepository, type DecisionWithDetails } from "../decisioning/decision.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  assertDecisionTransition,
  assertExecutionTaskTransition,
  isDecisionExecutionEligible,
  isExecutionTaskCancellable,
  isExecutionTaskRetryable,
} from "../workflow/decision-workflow-lifecycle.js";
import { OperatorOverrideService } from "../workflow/operator-override.service.js";
import {
  buildExecutionTaskIdempotencyKey,
  executionAuditEventTypes,
  executionOutboxEventTypes,
  executionTaskDefaults,
} from "./execution.constants.js";
import { toExecutionTaskDto } from "./execution.mappers.js";
import type {
  CancelExecutionTaskInput,
  ExecutionTaskDto,
  RetryExecutionTaskInput,
} from "./execution.schemas.js";
import { ExecutionTaskRepository, type ExecutionTaskWithAttempts } from "./execution-task.repository.js";
import { IdempotencyKeyRepository } from "./idempotency-key.repository.js";

const replenishmentDecisionPayloadSchema = z.object({
  skuId: z.string().uuid(),
  locationId: z.string().uuid(),
  supplierId: z.string().uuid(),
  recommendedOrderQty: z.coerce.number().int().positive(),
  unitOfMeasure: z.string().trim().min(1),
  expectedLeadTimeDays: z.coerce.number().int().positive().nullable().optional(),
  projectedDaysOfCover: z.coerce.number(),
  projectedShortfallQty: z.coerce.number(),
  basisDate: z.string().datetime(),
  recommendationType: z.string().trim().min(1),
});

export interface CreateExecutionTaskResult {
  decision: DecisionWithDetails;
  executionTask: ExecutionTaskWithAttempts;
  created: boolean;
}

const buildNotificationSummary = (decision: DecisionWithDetails): string => {
  const reasonCodes = decision.reasons.map((reason) => reason.code);
  if (decision.decisionType === "allocation") {
    return `Allocation recommendation generated for SKU ${decision.skuId ?? "unknown"} at location ${decision.locationId ?? "unknown"}.`;
  }

  if (decision.decisionType === "exception") {
    return `Exception decision raised for SKU ${decision.skuId ?? "unknown"} with reasons: ${reasonCodes.join(", ") || "unspecified"}.`;
  }

  return `Decision ${decision.id} requires operator attention.`;
};

export class ExecutionTaskService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly idempotencyKeyRepository: IdempotencyKeyRepository,
    private readonly operatorOverrideService: OperatorOverrideService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async listExecutionTasks(
    context: RequestContext,
    filters: { status?: ExecutionTaskStatus; decisionId?: string },
  ): Promise<ExecutionTaskDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "workflow.read");

    if (filters.decisionId) {
      await this.requireDecision(this.db, organizationId, filters.decisionId);
    }

    const executionTasks = await this.executionTaskRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
    });

    return executionTasks.map(toExecutionTaskDto);
  }

  public async getExecutionTask(context: RequestContext, executionTaskId: string): Promise<ExecutionTaskDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "workflow.read");

    const executionTask = await this.requireExecutionTask(this.db, organizationId, executionTaskId);
    return toExecutionTaskDto(executionTask);
  }

  public async retryExecutionTask(
    context: RequestContext,
    executionTaskId: string,
    input: RetryExecutionTaskInput,
  ): Promise<ExecutionTaskDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");
      const retriedTask = await this.retryExecutionTaskInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        executionTaskId,
        ...(input.reason ? { reason: input.reason } : {}),
      });

      return toExecutionTaskDto(retriedTask);
    });
  }

  public async retryExecutionTaskInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      executionTaskId: string;
      reason?: string;
    },
  ): Promise<ExecutionTaskWithAttempts> {
    const executionTask = await this.requireExecutionTask(db, input.organizationId, input.executionTaskId);
    let decision = await this.requireDecision(db, input.organizationId, executionTask.decisionId);

    if (executionTask.status === ExecutionTaskStatus.pending) {
      return executionTask;
    }

    if (!isExecutionTaskRetryable(executionTask.status)) {
      throw new ConflictError("Execution task is not retryable.");
    }

    assertExecutionTaskTransition(executionTask.status, ExecutionTaskStatus.pending);

    if (decision.status !== DecisionStatus.execution_requested) {
      assertDecisionTransition(decision.status, DecisionStatus.execution_requested);
      decision = await this.decisionRepository.updateStatusById(db, {
        id: decision.id,
        status: DecisionStatus.execution_requested,
      });
    }

    const retriedTask = await this.executionTaskRepository.updateById(db, {
      id: executionTask.id,
      data: {
        status: ExecutionTaskStatus.pending,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        lastError: null,
        nextRetryAt: null,
      },
    });

    const idempotencyKey = await this.idempotencyKeyRepository.findByKeyForOrganization(db, {
      organizationId: input.organizationId,
      key: buildExecutionTaskIdempotencyKey(executionTask.id),
    });
    if (idempotencyKey) {
      await this.idempotencyKeyRepository.updateById(db, {
        id: idempotencyKey.id,
        data: {
          status: IdempotencyKeyStatus.pending,
          responseHash: null,
        },
      });
    }

    await this.operatorOverrideService.recordOverrideInTransaction(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      decisionId: decision.id,
      executionTaskId: executionTask.id,
      overrideType: OperatorOverrideType.manual_retry,
      reason: input.reason ?? "Execution task retried manually.",
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: executionAuditEventTypes.requested,
      entityType: "ExecutionTask",
      entityId: retriedTask.id,
      payload: {
        decisionId: retriedTask.decisionId,
        taskType: retriedTask.taskType,
        targetSystem: retriedTask.targetSystem,
        status: retriedTask.status,
        decisionStatus: decision.status,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: executionOutboxEventTypes.requested,
      aggregateType: "ExecutionTask",
      aggregateId: retriedTask.id,
      payload: {
        organizationId: input.organizationId,
        executionTaskId: retriedTask.id,
        decisionId: retriedTask.decisionId,
        taskType: retriedTask.taskType,
        targetSystem: retriedTask.targetSystem,
        status: retriedTask.status,
        decisionStatus: decision.status,
      },
    });

    return retriedTask;
  }

  public async cancelExecutionTask(
    context: RequestContext,
    executionTaskId: string,
    input: CancelExecutionTaskInput,
  ): Promise<ExecutionTaskDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "workflow.write");

      const executionTask = await this.requireExecutionTask(db, organizationId, executionTaskId);
      let decision = await this.requireDecision(db, organizationId, executionTask.decisionId);

      if (executionTask.status === ExecutionTaskStatus.cancelled) {
        return toExecutionTaskDto(executionTask);
      }

      if (!isExecutionTaskCancellable(executionTask.status)) {
        throw new ConflictError("Execution task cannot be cancelled in its current state.");
      }

      assertExecutionTaskTransition(executionTask.status, ExecutionTaskStatus.cancelled);

      if (decision.status !== DecisionStatus.dismissed) {
        assertDecisionTransition(decision.status, DecisionStatus.dismissed);
        decision = await this.decisionRepository.updateStatusById(db, {
          id: decision.id,
          status: DecisionStatus.dismissed,
        });
      }

      const cancelledTask = await this.executionTaskRepository.updateById(db, {
        id: executionTask.id,
        data: {
          status: ExecutionTaskStatus.cancelled,
          nextRetryAt: null,
        },
      });

      await this.operatorOverrideService.recordOverrideInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        decisionId: decision.id,
        executionTaskId: executionTask.id,
        overrideType: OperatorOverrideType.manual_cancel_execution,
        reason: input.reason ?? "Execution task cancelled manually.",
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: executionAuditEventTypes.cancelled,
        entityType: "ExecutionTask",
        entityId: cancelledTask.id,
        payload: {
          decisionId: cancelledTask.decisionId,
          taskType: cancelledTask.taskType,
          targetSystem: cancelledTask.targetSystem,
          status: cancelledTask.status,
          decisionStatus: decision.status,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: executionOutboxEventTypes.cancelled,
        aggregateType: "ExecutionTask",
        aggregateId: cancelledTask.id,
        payload: {
          organizationId,
          executionTaskId: cancelledTask.id,
          decisionId: cancelledTask.decisionId,
          taskType: cancelledTask.taskType,
          targetSystem: cancelledTask.targetSystem,
          status: cancelledTask.status,
          decisionStatus: decision.status,
        },
      });

      return toExecutionTaskDto(cancelledTask);
    });
  }

  public async createExecutionTaskForDecisionInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      decisionId: string;
    },
  ): Promise<CreateExecutionTaskResult> {
    let decision = await this.requireDecision(db, input.organizationId, input.decisionId);
    if (!isDecisionExecutionEligible(decision.status)) {
      throw new ConflictError("Decision is not eligible for execution.");
    }

    const defaults = executionTaskDefaults[decision.decisionType];
    if (!defaults) {
      throw new ConflictError(`No execution defaults are configured for decision type ${decision.decisionType}.`);
    }

    const existingExecutionTask = await this.executionTaskRepository.findByDecisionAndType(db, {
      decisionId: decision.id,
      taskType: defaults.taskType,
      targetSystem: defaults.targetSystem,
    });
    if (existingExecutionTask) {
      if (
        decision.status !== DecisionStatus.execution_requested &&
        decision.status !== DecisionStatus.executing &&
        decision.status !== DecisionStatus.executed
      ) {
        assertDecisionTransition(decision.status, DecisionStatus.execution_requested);
        decision = await this.decisionRepository.updateStatusById(db, {
          id: decision.id,
          status: DecisionStatus.execution_requested,
        });
      }

      return {
        decision,
        executionTask: existingExecutionTask,
        created: false,
      };
    }

    if (decision.status !== DecisionStatus.execution_requested) {
      assertDecisionTransition(decision.status, DecisionStatus.execution_requested);
      decision = await this.decisionRepository.updateStatusById(db, {
        id: decision.id,
        status: DecisionStatus.execution_requested,
      });
    }

    const executionTask = await this.executionTaskRepository.create(db, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      taskType: defaults.taskType,
      status: ExecutionTaskStatus.pending,
      targetSystem: defaults.targetSystem,
      payload: this.buildExecutionPayload(decision),
      requestedByUserId: input.actorUserId,
      requestedAt: new Date(),
    });

    const executionTaskIdempotencyKey = buildExecutionTaskIdempotencyKey(executionTask.id);
    const existingIdempotencyKey = await this.idempotencyKeyRepository.findByKeyForOrganization(db, {
      organizationId: input.organizationId,
      key: executionTaskIdempotencyKey,
    });
    if (!existingIdempotencyKey) {
      await this.idempotencyKeyRepository.create(db, {
        organizationId: input.organizationId,
        scopeType: IdempotencyScopeType.execution_task,
        scopeReference: executionTask.id,
        key: executionTaskIdempotencyKey,
        status: IdempotencyKeyStatus.pending,
      });
    }

    const persistedExecutionTask = await this.requireExecutionTask(db, input.organizationId, executionTask.id);

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: executionAuditEventTypes.requested,
      entityType: "ExecutionTask",
      entityId: persistedExecutionTask.id,
      payload: {
        decisionId: decision.id,
        taskType: persistedExecutionTask.taskType,
        targetSystem: persistedExecutionTask.targetSystem,
        status: persistedExecutionTask.status,
        decisionStatus: decision.status,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: executionOutboxEventTypes.requested,
      aggregateType: "ExecutionTask",
      aggregateId: persistedExecutionTask.id,
      payload: {
        organizationId: input.organizationId,
        executionTaskId: persistedExecutionTask.id,
        decisionId: decision.id,
        taskType: persistedExecutionTask.taskType,
        targetSystem: persistedExecutionTask.targetSystem,
        status: persistedExecutionTask.status,
        decisionStatus: decision.status,
      },
    });

    return {
      decision,
      executionTask: persistedExecutionTask,
      created: true,
    };
  }

  private buildExecutionPayload(decision: DecisionWithDetails): Prisma.InputJsonObject {
    if (decision.decisionType === "replenishment") {
      const payload = replenishmentDecisionPayloadSchema.parse(decision.proposedPayload);
      return {
        decisionId: decision.id,
        skuId: payload.skuId,
        locationId: payload.locationId,
        supplierId: payload.supplierId,
        recommendedOrderQty: payload.recommendedOrderQty,
        unitOfMeasure: payload.unitOfMeasure,
        expectedLeadTimeDays: payload.expectedLeadTimeDays ?? null,
        projectedDaysOfCover: payload.projectedDaysOfCover,
        projectedShortfallQty: payload.projectedShortfallQty,
        basisDate: payload.basisDate,
        recommendationType: payload.recommendationType,
      };
    }

    return {
      decisionId: decision.id,
      summary: buildNotificationSummary(decision),
      context: {
        decisionType: decision.decisionType,
        skuId: decision.skuId,
        locationId: decision.locationId,
        supplierId: decision.supplierId,
        reasonCodes: decision.reasons.map((reason) => reason.code),
      },
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

  private async requireExecutionTask(
    db: DbClient,
    organizationId: string,
    executionTaskId: string,
  ): Promise<ExecutionTaskWithAttempts> {
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
