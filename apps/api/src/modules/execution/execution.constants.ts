import {
  ExecutionTargetSystem,
  ExecutionTaskStatus,
  ExecutionTaskType,
  type Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";

export const DEFAULT_EXECUTION_MAX_RETRY_COUNT = 3;
export const DEFAULT_EXECUTION_RETRY_DELAY_MINUTES = 5;

export const executionAuditEventTypes = {
  requested: "workflow.execution.requested",
  started: "workflow.execution.started",
  succeeded: "workflow.execution.succeeded",
  failed: "workflow.execution.failed",
  deadLettered: "workflow.execution.dead_lettered",
  cancelled: "workflow.execution.cancelled",
} as const;

export const executionOutboxEventTypes = {
  requested: "workflow.execution.requested.v1",
  started: "workflow.execution.started.v1",
  succeeded: "workflow.execution.succeeded.v1",
  failed: "workflow.execution.failed.v1",
  deadLettered: "workflow.execution.dead_lettered.v1",
  cancelled: "workflow.execution.cancelled.v1",
} as const;

export const buildExecutionTaskIdempotencyKey = (taskId: string): string => `execution_task:${taskId}`;

export const calculateNextRetryAt = (retryCount: number, now: Date): Date =>
  new Date(now.getTime() + retryCount * DEFAULT_EXECUTION_RETRY_DELAY_MINUTES * 60_000);

const stableStringify = (value: Prisma.JsonValue | Prisma.InputJsonValue): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
};

export const buildResponseHash = (value: Prisma.JsonValue | Prisma.InputJsonValue): string =>
  createHash("sha256").update(stableStringify(value)).digest("hex");

export const executionTaskDefaults = {
  replenishment: {
    taskType: ExecutionTaskType.create_purchase_order,
    targetSystem: ExecutionTargetSystem.internal_supply,
  },
  allocation: {
    taskType: ExecutionTaskType.notify_operator,
    targetSystem: ExecutionTargetSystem.internal_notification,
  },
  exception: {
    taskType: ExecutionTaskType.notify_operator,
    targetSystem: ExecutionTargetSystem.internal_notification,
  },
} as const satisfies Record<string, { taskType: ExecutionTaskType; targetSystem: ExecutionTargetSystem }>;

export const isTerminalExecutionTaskStatus = (status: ExecutionTaskStatus): boolean =>
  status === ExecutionTaskStatus.succeeded ||
  status === ExecutionTaskStatus.dead_lettered ||
  status === ExecutionTaskStatus.cancelled;
