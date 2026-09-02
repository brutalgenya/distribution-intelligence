import type {
  ExecutionTargetSystem,
  ExecutionTaskType,
  IdempotencyKey,
  Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { ExecutionTaskWithAttempts } from "./execution-task.repository.js";

export interface ExecutionAdapterExecuteInput {
  db: DbClient;
  task: ExecutionTaskWithAttempts;
  idempotencyKey: IdempotencyKey;
  actorUserId: string | null;
  correlationId: string;
}

export interface ExecutionAdapterSuccessResult {
  responsePayload: Prisma.InputJsonValue;
}

export class ExecutionAdapterError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly responsePayload: Prisma.InputJsonValue | undefined;

  public constructor(
    code: string,
    message: string,
    retryable: boolean,
    responsePayload?: Prisma.InputJsonValue,
  ) {
    super(message);
    this.name = "ExecutionAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.responsePayload = responsePayload;
  }
}

export interface ExecutionAdapter {
  readonly taskType: ExecutionTaskType;
  readonly targetSystem: ExecutionTargetSystem;

  execute(input: ExecutionAdapterExecuteInput): Promise<ExecutionAdapterSuccessResult>;
}
