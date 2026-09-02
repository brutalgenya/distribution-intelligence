import { AiRunStatus, AiRunType, ExecutionTaskStatus, ForecastJobStatus } from "@prisma/client";
import { z } from "zod";

const isoDateSchema = z.string().datetime();
const uuidSchema = z.string().uuid();
const MAX_SUPPORT_WINDOW_DAYS = 90;

export const supportListQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const supportExecutionListQuerySchema = z.object({
  status: z.nativeEnum(ExecutionTaskStatus).optional(),
  decisionId: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const supportForecastJobListQuerySchema = z.object({
  status: z.nativeEnum(ForecastJobStatus).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const supportAiRunListQuerySchema = z.object({
  status: z.nativeEnum(AiRunStatus).optional(),
  runType: z.nativeEnum(AiRunType).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const supportTimelineQuerySchema = z.object({
  decisionId: uuidSchema.optional(),
  executionTaskId: uuidSchema.optional(),
  correlationId: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(100),
});

export const supportOutboxQuerySchema = z.object({
  aggregateId: z.string().trim().min(1).optional(),
  eventType: z.string().trim().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const supportOutcomesQuerySchema = z.object({
  decisionId: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const supportEntityIdParamsSchema = z.object({
  id: uuidSchema,
});

export const supportRequeueBodySchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export const supportOutcomeRecomputeBodySchema = z.object({
  measurementWindowStart: isoDateSchema,
  measurementWindowEnd: isoDateSchema,
}).superRefine((value, ctx) => {
  const start = new Date(value.measurementWindowStart);
  const end = new Date(value.measurementWindowEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return;
  }

  if (end.getTime() <= start.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "measurementWindowEnd must be after measurementWindowStart.",
      path: ["measurementWindowEnd"],
    });
    return;
  }

  const durationDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (durationDays > MAX_SUPPORT_WINDOW_DAYS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `measurement window must not exceed ${MAX_SUPPORT_WINDOW_DAYS} days.`,
      path: ["measurementWindowEnd"],
    });
  }
});

export interface SupportTimelineItemDto {
  type: "audit_event" | "execution_attempt" | "ai_run" | "outbox_event" | "decision_outcome";
  id: string;
  createdAt: string;
  correlationId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}
