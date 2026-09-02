import { z } from "zod";

import {
  ExecutionAdapter,
  ExecutionAdapterError,
  type ExecutionAdapterExecuteInput,
  type ExecutionAdapterSuccessResult,
} from "./execution-adapter.js";

const notificationExecutionPayloadSchema = z.object({
  decisionId: z.string().uuid(),
  summary: z.string().trim().min(1),
  context: z.record(z.unknown()).optional(),
  testFailureMode: z.enum(["retryable", "non_retryable"]).optional(),
  testFailureUntilAttemptNumber: z.coerce.number().int().positive().optional(),
});

export class InternalNotificationExecutionAdapter implements ExecutionAdapter {
  public readonly taskType = "notify_operator" as const;
  public readonly targetSystem = "internal_notification" as const;

  public async execute(input: ExecutionAdapterExecuteInput): Promise<ExecutionAdapterSuccessResult> {
    const payload = notificationExecutionPayloadSchema.parse(input.task.payload);
    const currentAttemptNumber = input.task.attempts.at(-1)?.attemptNumber ?? 1;
    const failUntilAttemptNumber = payload.testFailureUntilAttemptNumber ?? Number.POSITIVE_INFINITY;

    if (payload.testFailureMode && currentAttemptNumber <= failUntilAttemptNumber) {
      throw new ExecutionAdapterError(
        payload.testFailureMode === "retryable" ? "notification_retryable" : "notification_rejected",
        `Notification execution failed for task ${input.task.id}.`,
        payload.testFailureMode === "retryable",
        {
          delivered: false,
          notificationReference: input.task.id,
          summary: payload.summary,
        },
      );
    }

    return {
      responsePayload: {
        delivered: true,
        notificationReference: `notification:${input.task.id}`,
        decisionId: payload.decisionId,
        summary: payload.summary,
      },
    };
  }
}
