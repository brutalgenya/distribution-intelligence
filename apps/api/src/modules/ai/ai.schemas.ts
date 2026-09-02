import {
  AiModelType,
  AiRunStatus,
  AiRunType,
  AnomalySeverity,
  ModelRegistryStatus,
} from "@prisma/client";
import { z } from "zod";

const MAX_AI_MEASUREMENT_WINDOW_DAYS = 90;

export const modelRegistryEntryIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createModelRegistryEntryBodySchema = z.object({
  provider: z.string().trim().min(1).max(100),
  modelName: z.string().trim().min(1).max(200),
  modelVersion: z.string().trim().min(1).max(100),
  modelType: z.nativeEnum(AiModelType),
  promptVersion: z.string().trim().min(1).max(100).optional(),
  schemaVersion: z.string().trim().min(1).max(100),
  status: z.nativeEnum(ModelRegistryStatus).default(ModelRegistryStatus.inactive),
});

export const updateModelRegistryEntryBodySchema = z.object({
  provider: z.string().trim().min(1).max(100).optional(),
  modelName: z.string().trim().min(1).max(200).optional(),
  modelVersion: z.string().trim().min(1).max(100).optional(),
  modelType: z.nativeEnum(AiModelType).optional(),
  promptVersion: z.string().trim().min(1).max(100).nullable().optional(),
  schemaVersion: z.string().trim().min(1).max(100).optional(),
  status: z.nativeEnum(ModelRegistryStatus).optional(),
});

export const listModelRegistryEntriesQuerySchema = z.object({
  modelType: z.nativeEnum(AiModelType).optional(),
  status: z.nativeEnum(ModelRegistryStatus).optional(),
});

export const enhanceForecastBodySchema = z.object({
  forecastJobId: z.string().uuid(),
});

export const aiRunIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listAiRunsQuerySchema = z.object({
  runType: z.nativeEnum(AiRunType).optional(),
  status: z.nativeEnum(AiRunStatus).optional(),
});

export const scoreAnomalyBodySchema = z.object({
  measurementWindowStart: z.string().datetime(),
  measurementWindowEnd: z.string().datetime(),
  skuId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
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
  if (durationDays > MAX_AI_MEASUREMENT_WINDOW_DAYS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `measurement window must not exceed ${MAX_AI_MEASUREMENT_WINDOW_DAYS} days.`,
      path: ["measurementWindowEnd"],
    });
  }
});

export const listAnomalyScoresQuerySchema = z.object({
  skuId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

export const decisionIdParamsSchema = z.object({
  decisionId: z.string().uuid(),
});

export const listDecisionExplanationsQuerySchema = z.object({
  decisionId: z.string().uuid().optional(),
});

export const artifactIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const forecastEnhancementOutputSchema = z.object({
  adjustedForecasts: z.array(
    z.object({
      skuId: z.string().uuid(),
      locationId: z.string().uuid().nullable().optional(),
      forecastDate: z.string().datetime(),
      enhancedForecastQty: z.coerce.number().int().nonnegative(),
      confidenceLow: z.coerce.number().int().nonnegative().nullable().optional(),
      confidenceHigh: z.coerce.number().int().nonnegative().nullable().optional(),
    }),
  ),
  explanationSummary: z.string().trim().min(1).max(1000).optional(),
});

export const anomalyScoringOutputSchema = z.object({
  anomalyScore: z.coerce.number().min(0).max(1),
  severity: z.nativeEnum(AnomalySeverity),
  explanationSummary: z.string().trim().min(1).max(1000).optional(),
  factors: z.array(z.string().trim().min(1)).max(10).optional(),
});

export const decisionExplanationOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  bullets: z.array(z.string().trim().min(1)).min(1).max(10),
  caution: z.string().trim().min(1).max(1000).optional(),
});

export type CreateModelRegistryEntryInput = z.infer<typeof createModelRegistryEntryBodySchema>;
export type UpdateModelRegistryEntryInput = z.infer<typeof updateModelRegistryEntryBodySchema>;
export type EnhanceForecastInput = z.infer<typeof enhanceForecastBodySchema>;
export type ScoreAnomalyInput = z.infer<typeof scoreAnomalyBodySchema>;
export type ForecastEnhancementOutput = z.infer<typeof forecastEnhancementOutputSchema>;
export type AnomalyScoringOutput = z.infer<typeof anomalyScoringOutputSchema>;
export type DecisionExplanationOutput = z.infer<typeof decisionExplanationOutputSchema>;

export type AiProcessingStatus =
  | "succeeded"
  | "failed"
  | "degraded"
  | "deduplicated"
  | "skipped_no_active_model";

export interface ModelRegistryEntryDto {
  id: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  modelType: AiModelType;
  promptVersion: string | null;
  schemaVersion: string;
  status: ModelRegistryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiRunDto {
  id: string;
  organizationId: string;
  modelRegistryEntryId: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  modelType: AiModelType;
  promptVersion: string | null;
  runType: AiRunType;
  status: AiRunStatus;
  subjectType: string;
  subjectReference: string;
  inputChecksum: string;
  inputPayload: unknown;
  outputPayload: unknown;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface EnhancedForecastResultDto {
  id: string;
  organizationId: string;
  forecastJobId: string;
  aiRunId: string;
  modelRegistryEntryId: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  skuId: string;
  locationId: string | null;
  forecastDate: string;
  baselineForecastQty: number;
  enhancedForecastQty: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastEnhancementResponseDto {
  status: AiProcessingStatus;
  baselineFallbackUsed: boolean;
  run: AiRunDto | null;
  enhancedResults: EnhancedForecastResultDto[];
}

export interface AnomalyScoreDto {
  id: string;
  organizationId: string;
  aiRunId: string;
  modelRegistryEntryId: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  subjectType: string;
  subjectReference: string;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  anomalyScore: number;
  severity: AnomalySeverity;
  explanationSummary: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalyScoringResponseDto {
  status: AiProcessingStatus;
  run: AiRunDto | null;
  anomalyScore: AnomalyScoreDto | null;
}

export interface DecisionExplanationDto {
  id: string;
  organizationId: string;
  decisionId: string;
  aiRunId: string;
  modelRegistryEntryId: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  summary: string;
  explanationJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionExplanationResponseDto {
  status: AiProcessingStatus;
  run: AiRunDto | null;
  explanation: DecisionExplanationDto | null;
}
