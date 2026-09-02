import { ForecastJobStatus, ForecastModelType, ForecastScopeType } from "@prisma/client";
import { z } from "zod";

import type {
  AiProcessingStatus,
  AiRunDto,
  EnhancedForecastResultDto,
} from "../ai/ai.schemas.js";

export const forecastJobIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createForecastJobBodySchema = z
  .object({
    scopeType: z.nativeEnum(ForecastScopeType),
    skuId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    horizonDays: z.coerce.number().int().positive().max(180),
    modelType: z.nativeEnum(ForecastModelType).default(ForecastModelType.baseline_recent_average),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === ForecastScopeType.sku && !value.skuId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "skuId is required for sku scope.",
        path: ["skuId"],
      });
    }

    if (value.scopeType === ForecastScopeType.sku_location) {
      if (!value.skuId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "skuId is required for sku_location scope.",
          path: ["skuId"],
        });
      }

      if (!value.locationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "locationId is required for sku_location scope.",
          path: ["locationId"],
        });
      }
    }

    if (value.scopeType === ForecastScopeType.organization) {
      if (value.skuId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "skuId is not allowed for organization scope.",
          path: ["skuId"],
        });
      }

      if (value.locationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "locationId is not allowed for organization scope.",
          path: ["locationId"],
        });
      }
    }
  });

export type CreateForecastJobInput = z.infer<typeof createForecastJobBodySchema>;

export const listForecastJobsQuerySchema = z.object({
  status: z.nativeEnum(ForecastJobStatus).optional(),
});

export const forecastJobInputSnapshotSchema = z.object({
  anchorDate: z.string().datetime(),
  demandSignalCreatedAtCutoff: z.string().datetime(),
  lookbackDays: z.coerce.number().int().positive(),
  horizonDays: z.coerce.number().int().positive(),
  modelType: z.nativeEnum(ForecastModelType),
  scopeType: z.nativeEnum(ForecastScopeType),
  scopeReference: z
    .object({
      skuId: z.string().uuid().optional(),
      locationId: z.string().uuid().optional(),
    })
    .nullable(),
});

export interface ForecastJobDto {
  id: string;
  organizationId: string;
  status: ForecastJobStatus;
  requestedByUserId: string;
  scopeType: ForecastScopeType;
  scopeReference: unknown;
  horizonDays: number;
  modelType: ForecastModelType;
  inputSnapshot: unknown;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ForecastResultDto {
  id: string;
  organizationId: string;
  forecastJobId: string;
  skuId: string;
  locationId: string | null;
  forecastDate: string;
  forecastQty: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  modelType: ForecastModelType;
  createdAt: string;
}

export interface ForecastJobProcessingResultDto {
  job: ForecastJobDto;
  results: ForecastResultDto[];
  processedNow: boolean;
  enhancementStatus?: AiProcessingStatus | null;
  enhancementRun?: AiRunDto | null;
  enhancedResults?: EnhancedForecastResultDto[];
  baselineFallbackUsed?: boolean;
}
