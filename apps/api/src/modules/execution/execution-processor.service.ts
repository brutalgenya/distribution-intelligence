import { randomUUID } from "node:crypto";

import {
  DecisionStatus,
  ExecutionAttemptStatus,
  ExecutionTaskStatus,
  IdempotencyKeyStatus,
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
import { DecisionRepository } from "../decisioning/decision.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { assertDecisionTransition } from "../workflow/decision-workflow-lifecycle.js";
import {
  buildExecutionTaskIdempotencyKey,
  buildResponseHash,
  calculateNextRetryAt,
  DEFAULT_EXECUTION_MAX_RETRY_COUNT,
  executionAuditEventTypes,
  executionOutboxEventTypes,
  isTerminalExecutionTaskStatus,
} from "./execution.constants.js";
import { toExecutionAttemptDto, toExecutionTaskDto } from "./execution.mappers.js";
import { ExecutionAdapterError } from "./execution-adapter.js";
import { ExecutionAdapterRegistry } from "./execution-adapter-registry.js";
import type { ExecutionProcessingResultDto } from "./execution.schemas.js";
import { ExecutionAttemptRepository } from "./execution-attempt.repository.js";
import { ExecutionTaskRepository, type ExecutionTaskWithAttempts } from "./execution-task.repository.js";
import { IdempotencyKeyRepository } from "./idempotency-key.repository.js";

type ClaimResult =
  | { kind: "terminal"; task: ExecutionTaskWithAttempts }
  | { kind: "scheduled"; task: ExecutionTaskWithAttempts }
  | { kind: "running"; task: ExecutionTaskWithAttempts }
  | { kind: "claimed"; task: ExecutionTaskWithAttempts };

const toExecutionError = (error: unknown): ExecutionAdapterError => {
  if (error instanceof ExecutionAdapterError) {
    return error;
  }

  if (error instanceof Error) {
    return new ExecutionAdapterError("execution_failed", error.message, false);
  }

  return new ExecutionAdapterError("execution_failed", "Execution failed.", false);
};

export class ExecutionProcessorService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly executionAttemptRepository: ExecutionAttemptRepository,
    private readonly idempotencyKeyRepository: IdempotencyKeyRepository,
    private readonly executionAdapterRegistry: ExecutionAdapterRegistry,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async processPendingTasks(limit = 10): Promise<number> {
    let processedCount = 0;

    while (processedCount < limit) {
      const nextTask = await this.executionTaskRepository.findNextRunnable(this.db, new Date());
      if (!nextTask) {
        break;
      }

      const result = await this.processTaskInternal(nextTask.id, {
        actorUserId: nextTask.requestedByUserId,
        correlationId: randomUUID(),
      });

      if (result.processedNow) {
        processedCount += 1;
      }
    }

    return processedCount;
  }

  public async processExecutionTask(
    context: RequestContext,
    executionTaskId: string,
  ): Promise<ExecutionProcessingResultDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "workflow.write");

    const executionTask = await this.executionTaskRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: executionTaskId,
    });
    if (!executionTask) {
      throw new NotFoundError("Execution task was not found.");
    }

    return this.processTaskInternal(executionTaskId, {
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });
  }

  private async processTaskInternal(
    executionTaskId: string,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<ExecutionProcessingResultDto> {
    return this.telemetryService.measureAsync(
      "execution.task.duration_ms",
      async () => {
        const claimResult = await this.claimTask(executionTaskId, options);

        if (claimResult.kind === "terminal" || claimResult.kind === "scheduled") {
          return {
            task: toExecutionTaskDto(claimResult.task),
            attempt: claimResult.task.attempts.length > 0 ? toExecutionAttemptDto(claimResult.task.attempts.at(-1)!) : null,
            processedNow: false,
          };
        }

        if (claimResult.kind === "running") {
          throw new ConflictError("Execution task is already running.");
        }

        const claimedTask = claimResult.task;

        try {
          const result = await this.transactionRunner.run(async (db) => {
            const executionTask = await this.requireExecutionTask(db, claimedTask.organizationId, claimedTask.id);
            const attempt = executionTask.attempts.at(-1);
            if (!attempt) {
              throw new NotFoundError("Execution attempt was not found.");
            }

            const idempotencyKey = await this.requireIdempotencyKey(db, executionTask.organizationId, executionTask.id);
            const adapter = this.executionAdapterRegistry.getAdapter(executionTask.taskType, executionTask.targetSystem);
            const adapterResult = await adapter.execute({
              db,
              task: executionTask,
              idempotencyKey,
              actorUserId: options.actorUserId,
              correlationId: options.correlationId,
            });

            const completedAt = new Date();

            const updatedAttempt = await this.executionAttemptRepository.updateById(db, {
              id: attempt.id,
              data: {
                status: ExecutionAttemptStatus.succeeded,
                completedAt,
                responsePayload: adapterResult.responsePayload,
              },
            });

            const updatedTask = await this.executionTaskRepository.updateById(db, {
              id: executionTask.id,
              data: {
                status: ExecutionTaskStatus.succeeded,
                completedAt,
                failedAt: null,
                lastError: null,
                nextRetryAt: null,
              },
            });

        const decision = await this.decisionRepository.findByIdForOrganization(db, {
          organizationId: executionTask.organizationId,
          id: executionTask.decisionId,
        });
        if (!decision) {
          throw new NotFoundError("Decision was not found.");
        }
        if (decision.status !== DecisionStatus.executed) {
          assertDecisionTransition(decision.status, DecisionStatus.executed);
          await this.decisionRepository.updateStatusById(db, {
            id: decision.id,
            status: DecisionStatus.executed,
          });
        }

        await this.idempotencyKeyRepository.updateById(db, {
          id: idempotencyKey.id,
          data: {
            status: IdempotencyKeyStatus.succeeded,
            responseHash: buildResponseHash(adapterResult.responsePayload),
          },
        });

        await this.auditEventRepository.create(db, {
          organizationId: executionTask.organizationId,
          actorUserId: options.actorUserId,
          eventType: executionAuditEventTypes.succeeded,
          entityType: "ExecutionTask",
          entityId: executionTask.id,
          payload: {
            decisionId: executionTask.decisionId,
            attemptNumber: updatedAttempt.attemptNumber,
            status: updatedTask.status,
          },
          correlationId: options.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId: executionTask.organizationId,
          eventType: executionOutboxEventTypes.succeeded,
          aggregateType: "ExecutionTask",
          aggregateId: executionTask.id,
          payload: {
            organizationId: executionTask.organizationId,
            executionTaskId: executionTask.id,
            decisionId: executionTask.decisionId,
            attemptNumber: updatedAttempt.attemptNumber,
            status: updatedTask.status,
          },
        });

            return {
              task: toExecutionTaskDto(updatedTask),
              attempt: toExecutionAttemptDto(updatedAttempt),
              processedNow: true,
            };
          });

          this.telemetryService.incrementCounter("execution.task.succeeded", 1, {
            organizationId: claimedTask.organizationId,
            taskType: claimedTask.taskType,
          });
          this.logger.info(
            "Execution task processed successfully.",
            { executionTaskId: claimedTask.id, decisionId: claimedTask.decisionId },
            { module: "execution", operation: "processTask", organizationId: claimedTask.organizationId, executionTaskId: claimedTask.id },
          );

          return result;
        } catch (error) {
          const executionError = toExecutionError(error);

          const result = await this.transactionRunner.run(async (db) => {
            const executionTask = await this.requireExecutionTask(db, claimedTask.organizationId, claimedTask.id);
            const attempt = executionTask.attempts.at(-1);
            if (!attempt) {
              throw new NotFoundError("Execution attempt was not found.");
            }

            const nextRetryCount = executionTask.retryCount + 1;
            const shouldRetry =
              executionError.retryable && nextRetryCount < DEFAULT_EXECUTION_MAX_RETRY_COUNT;
            const nextStatus = shouldRetry ? ExecutionTaskStatus.failed : ExecutionTaskStatus.dead_lettered;
            const now = new Date();

            const updatedAttempt = await this.executionAttemptRepository.updateById(db, {
              id: attempt.id,
              data: {
                status: ExecutionAttemptStatus.failed,
                completedAt: now,
                errorCode: executionError.code,
                errorMessage: executionError.message,
                ...(executionError.responsePayload ? { responsePayload: executionError.responsePayload } : {}),
              },
            });

            const updatedTask = await this.executionTaskRepository.updateById(db, {
              id: executionTask.id,
              data: {
                status: nextStatus,
                retryCount: nextRetryCount,
                failedAt: now,
                lastError: executionError.message.slice(0, 1000),
                completedAt: null,
                nextRetryAt: shouldRetry ? calculateNextRetryAt(nextRetryCount, now) : null,
              },
            });

            const decision = await this.decisionRepository.findByIdForOrganization(db, {
              organizationId: executionTask.organizationId,
              id: executionTask.decisionId,
            });
            if (!decision) {
              throw new NotFoundError("Decision was not found.");
            }
            if (decision.status !== DecisionStatus.execution_failed) {
              assertDecisionTransition(decision.status, DecisionStatus.execution_failed);
              await this.decisionRepository.updateStatusById(db, {
                id: decision.id,
                status: DecisionStatus.execution_failed,
              });
            }

            const idempotencyKey = await this.requireIdempotencyKey(
              db,
              executionTask.organizationId,
              executionTask.id,
            );
            await this.idempotencyKeyRepository.updateById(db, {
              id: idempotencyKey.id,
              data: {
                status: IdempotencyKeyStatus.failed,
                responseHash: null,
              },
            });

            const eventType =
              nextStatus === ExecutionTaskStatus.dead_lettered
                ? executionAuditEventTypes.deadLettered
                : executionAuditEventTypes.failed;
            const outboxEventType =
              nextStatus === ExecutionTaskStatus.dead_lettered
                ? executionOutboxEventTypes.deadLettered
                : executionOutboxEventTypes.failed;

            await this.auditEventRepository.create(db, {
              organizationId: executionTask.organizationId,
              actorUserId: options.actorUserId,
              eventType,
              entityType: "ExecutionTask",
              entityId: executionTask.id,
              payload: {
                decisionId: executionTask.decisionId,
                attemptNumber: updatedAttempt.attemptNumber,
                status: updatedTask.status,
                retryCount: updatedTask.retryCount,
                errorCode: updatedAttempt.errorCode,
                errorMessage: updatedAttempt.errorMessage,
              },
              correlationId: options.correlationId,
            });

            await this.outboxEventRepository.create(db, {
              organizationId: executionTask.organizationId,
              eventType: outboxEventType,
              aggregateType: "ExecutionTask",
              aggregateId: executionTask.id,
              payload: {
                organizationId: executionTask.organizationId,
                executionTaskId: executionTask.id,
                decisionId: executionTask.decisionId,
                attemptNumber: updatedAttempt.attemptNumber,
                status: updatedTask.status,
                retryCount: updatedTask.retryCount,
                errorCode: updatedAttempt.errorCode,
              },
            });

            return {
              task: toExecutionTaskDto(updatedTask),
              attempt: toExecutionAttemptDto(updatedAttempt),
              processedNow: true,
            };
          });

          this.telemetryService.incrementCounter(
            result.task.status === ExecutionTaskStatus.dead_lettered
              ? "execution.task.dead_lettered"
              : "execution.task.failed",
            1,
            {
              organizationId: claimedTask.organizationId,
              taskType: claimedTask.taskType,
            },
          );
          this.logger.error(
            "Execution task processing failed.",
            { executionTaskId: claimedTask.id, error: executionError.message, status: result.task.status },
            { module: "execution", operation: "processTask", organizationId: claimedTask.organizationId, executionTaskId: claimedTask.id },
          );

          return result;
        }
      },
      { executionTaskId },
    );
  }

  private async claimTask(
    executionTaskId: string,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<ClaimResult> {
    return this.transactionRunner.run(async (db) => {
      const currentTask = await this.executionTaskRepository.findById(db, executionTaskId);
      if (!currentTask) {
        throw new NotFoundError("Execution task was not found.");
      }

      if (isTerminalExecutionTaskStatus(currentTask.status)) {
        return { kind: "terminal", task: currentTask };
      }

      if (currentTask.status === ExecutionTaskStatus.running) {
        return { kind: "running", task: currentTask };
      }

      const now = new Date();
      if (
        currentTask.status === ExecutionTaskStatus.failed &&
        currentTask.nextRetryAt !== null &&
        currentTask.nextRetryAt > now
      ) {
        return { kind: "scheduled", task: currentTask };
      }

      const runningTask = await this.executionTaskRepository.markRunningIfProcessable(db, {
        id: executionTaskId,
        startedAt: now,
        now,
      });
      if (!runningTask) {
        const latestTask = await this.executionTaskRepository.findById(db, executionTaskId);
        if (!latestTask) {
          throw new NotFoundError("Execution task was not found.");
        }

        if (latestTask.status === ExecutionTaskStatus.running) {
          return { kind: "running", task: latestTask };
        }

        return { kind: "terminal", task: latestTask };
      }

      const decision = await this.decisionRepository.findByIdForOrganization(db, {
        organizationId: runningTask.organizationId,
        id: runningTask.decisionId,
      });
      if (!decision) {
        throw new NotFoundError("Decision was not found.");
      }

      if (decision.status !== DecisionStatus.executing) {
        assertDecisionTransition(decision.status, DecisionStatus.executing);
        await this.decisionRepository.updateStatusById(db, {
          id: decision.id,
          status: DecisionStatus.executing,
        });
      }

      const latestAttempt = await this.executionAttemptRepository.findLatestByTaskId(db, runningTask.id);
      const nextAttemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;
      await this.executionAttemptRepository.create(db, {
        organizationId: runningTask.organizationId,
        executionTaskId: runningTask.id,
        attemptNumber: nextAttemptNumber,
        status: ExecutionAttemptStatus.running,
        startedAt: now,
      });

      await this.auditEventRepository.create(db, {
        organizationId: runningTask.organizationId,
        actorUserId: options.actorUserId,
        eventType: executionAuditEventTypes.started,
        entityType: "ExecutionTask",
        entityId: runningTask.id,
        payload: {
          decisionId: runningTask.decisionId,
          taskType: runningTask.taskType,
          targetSystem: runningTask.targetSystem,
          status: ExecutionTaskStatus.running,
          attemptNumber: nextAttemptNumber,
        },
        correlationId: options.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: runningTask.organizationId,
        eventType: executionOutboxEventTypes.started,
        aggregateType: "ExecutionTask",
        aggregateId: runningTask.id,
        payload: {
          organizationId: runningTask.organizationId,
          executionTaskId: runningTask.id,
          decisionId: runningTask.decisionId,
          status: ExecutionTaskStatus.running,
          attemptNumber: nextAttemptNumber,
        },
      });

      const persistedTask = await this.executionTaskRepository.findById(db, runningTask.id);
      if (!persistedTask) {
        throw new NotFoundError("Execution task was not found.");
      }

      return { kind: "claimed", task: persistedTask };
    });
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

  private async requireIdempotencyKey(
    db: DbClient,
    organizationId: string,
    executionTaskId: string,
  ) {
    const idempotencyKey = await this.idempotencyKeyRepository.findByKeyForOrganization(db, {
      organizationId,
      key: buildExecutionTaskIdempotencyKey(executionTaskId),
    });
    if (!idempotencyKey) {
      throw new NotFoundError("Execution task idempotency key was not found.");
    }

    return idempotencyKey;
  }
}
