import type { ExecutionAttemptWithTask } from "./execution-attempt.repository.js";
import type { ExecutionTaskWithAttempts } from "./execution-task.repository.js";
import type {
  ExecutionAttemptDto,
  ExecutionTaskDto,
} from "./execution.schemas.js";

export const toExecutionAttemptDto = (
  executionAttempt: ExecutionAttemptWithTask | ExecutionTaskWithAttempts["attempts"][number],
): ExecutionAttemptDto => ({
  id: executionAttempt.id,
  organizationId: executionAttempt.organizationId,
  executionTaskId: executionAttempt.executionTaskId,
  attemptNumber: executionAttempt.attemptNumber,
  status: executionAttempt.status,
  startedAt: executionAttempt.startedAt.toISOString(),
  completedAt: executionAttempt.completedAt?.toISOString() ?? null,
  errorCode: executionAttempt.errorCode,
  errorMessage: executionAttempt.errorMessage,
  responsePayload: executionAttempt.responsePayload,
  createdAt: executionAttempt.createdAt.toISOString(),
});

export const toExecutionTaskDto = (executionTask: ExecutionTaskWithAttempts): ExecutionTaskDto => ({
  id: executionTask.id,
  organizationId: executionTask.organizationId,
  decisionId: executionTask.decisionId,
  taskType: executionTask.taskType,
  status: executionTask.status,
  targetSystem: executionTask.targetSystem,
  payload: executionTask.payload,
  requestedByUserId: executionTask.requestedByUserId,
  requestedAt: executionTask.requestedAt.toISOString(),
  startedAt: executionTask.startedAt?.toISOString() ?? null,
  completedAt: executionTask.completedAt?.toISOString() ?? null,
  failedAt: executionTask.failedAt?.toISOString() ?? null,
  lastError: executionTask.lastError,
  retryCount: executionTask.retryCount,
  nextRetryAt: executionTask.nextRetryAt?.toISOString() ?? null,
  createdAt: executionTask.createdAt.toISOString(),
  updatedAt: executionTask.updatedAt.toISOString(),
  attempts: executionTask.attempts.map(toExecutionAttemptDto),
});
