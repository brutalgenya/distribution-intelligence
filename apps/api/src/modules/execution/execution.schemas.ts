import {
  ExecutionTargetSystem,
  ExecutionTaskStatus,
  ExecutionTaskType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import type { ApprovalTaskDto } from "../workflow/workflow.schemas.js";
import type { DecisionDto } from "../decisioning/decisioning.schemas.js";

const jsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(jsonValueSchema);

export const executionTaskIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createExecutionTaskBodySchema = z.object({
  decisionId: z.string().uuid(),
});

export type CreateExecutionTaskInput = z.infer<typeof createExecutionTaskBodySchema>;

export const listExecutionTasksQuerySchema = z.object({
  status: z.nativeEnum(ExecutionTaskStatus).optional(),
  decisionId: z.string().uuid().optional(),
});

export const retryExecutionTaskBodySchema = z
  .object({
    reason: z.string().trim().max(1000).optional(),
  })
  .default({});

export type RetryExecutionTaskInput = z.infer<typeof retryExecutionTaskBodySchema>;

export const cancelExecutionTaskBodySchema = z
  .object({
    reason: z.string().trim().max(1000).optional(),
  })
  .default({});

export type CancelExecutionTaskInput = z.infer<typeof cancelExecutionTaskBodySchema>;

export interface ExecutionAttemptDto {
  id: string;
  organizationId: string;
  executionTaskId: string;
  attemptNumber: number;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  responsePayload: unknown;
  createdAt: string;
}

export interface ExecutionTaskDto {
  id: string;
  organizationId: string;
  decisionId: string;
  taskType: ExecutionTaskType;
  status: ExecutionTaskStatus;
  targetSystem: ExecutionTargetSystem;
  payload: unknown;
  requestedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: ExecutionAttemptDto[];
}

export interface ExecutionRequestResultDto {
  decision: DecisionDto;
  approvalTask: ApprovalTaskDto | null;
  executionTask: ExecutionTaskDto | null;
  routedToApproval: boolean;
}

export interface ExecutionProcessingResultDto {
  task: ExecutionTaskDto;
  attempt: ExecutionAttemptDto | null;
  processedNow: boolean;
}
