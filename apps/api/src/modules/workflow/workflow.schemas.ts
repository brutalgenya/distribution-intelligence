import {
  ApprovalTaskPurpose,
  ApprovalTaskStatus,
  OperatorOverrideType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import type { DecisionDto } from "../decisioning/decisioning.schemas.js";
import type { ExecutionTaskDto } from "../execution/execution.schemas.js";

const jsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(jsonValueSchema);

export const approvalTaskIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const decisionWorkflowParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createApprovalTaskBodySchema = z.object({
  decisionId: z.string().uuid(),
  purpose: z.nativeEnum(ApprovalTaskPurpose).default(ApprovalTaskPurpose.decision_review),
  assignedToUserId: z.string().uuid().optional(),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateApprovalTaskInput = z.infer<typeof createApprovalTaskBodySchema>;

export const requestDecisionApprovalBodySchema = z
  .object({
    assignedToUserId: z.string().uuid().optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .default({});

export type RequestDecisionApprovalInput = z.infer<typeof requestDecisionApprovalBodySchema>;

export const decideApprovalTaskBodySchema = z
  .object({
    comment: z.string().trim().max(1000).optional(),
  })
  .default({});

export type DecideApprovalTaskInput = z.infer<typeof decideApprovalTaskBodySchema>;

export const listApprovalTasksQuerySchema = z.object({
  status: z.nativeEnum(ApprovalTaskStatus).optional(),
  decisionId: z.string().uuid().optional(),
});

export const createOperatorOverrideBodySchema = z
  .object({
    decisionId: z.string().uuid().optional(),
    executionTaskId: z.string().uuid().optional(),
    overrideType: z.nativeEnum(OperatorOverrideType),
    reason: z.string().trim().min(1).max(1000),
    payload: jsonObjectSchema.optional(),
  })
  .refine((value) => value.decisionId !== undefined || value.executionTaskId !== undefined, {
    message: "decisionId or executionTaskId is required.",
    path: ["decisionId"],
  });

export type CreateOperatorOverrideInput = z.infer<typeof createOperatorOverrideBodySchema>;

export const listOperatorOverridesQuerySchema = z.object({
  decisionId: z.string().uuid().optional(),
  executionTaskId: z.string().uuid().optional(),
  overrideType: z.nativeEnum(OperatorOverrideType).optional(),
});

export interface ApprovalTaskDto {
  id: string;
  organizationId: string;
  decisionId: string;
  purpose: ApprovalTaskPurpose;
  status: ApprovalTaskStatus;
  requestedByUserId: string | null;
  assignedToUserId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTaskActionResultDto {
  approvalTask: ApprovalTaskDto;
  decision: DecisionDto;
  executionTask: ExecutionTaskDto | null;
}

export interface OperatorOverrideDto {
  id: string;
  organizationId: string;
  decisionId: string | null;
  executionTaskId: string | null;
  overrideType: OperatorOverrideType;
  reason: string;
  payload: unknown;
  createdByUserId: string;
  createdAt: string;
}
