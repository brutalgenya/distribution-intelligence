import {
  DecisionOutcomeStatus,
  OutcomeScopeType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

const MAX_OUTCOME_MEASUREMENT_WINDOW_DAYS = 90;

const measurementWindowBaseSchema = z.object({
  measurementWindowStart: z.string().datetime({ offset: true }),
  measurementWindowEnd: z.string().datetime({ offset: true }),
});

const withMeasurementWindowValidation = <Schema extends z.ZodTypeAny>(schema: Schema): Schema =>
  schema.superRefine((value: { measurementWindowStart: string; measurementWindowEnd: string }, ctx) => {
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
    if (durationDays > MAX_OUTCOME_MEASUREMENT_WINDOW_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `measurement window must not exceed ${MAX_OUTCOME_MEASUREMENT_WINDOW_DAYS} days.`,
        path: ["measurementWindowEnd"],
      });
    }
  }) as unknown as Schema;

const scopeFilterSchema = z.object({
  skuId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

export const outcomeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const decisionScopedParamsSchema = z.object({
  decisionId: z.string().uuid(),
});

export const policyScopedParamsSchema = z.object({
  policyId: z.string().uuid(),
});

export const computeStockoutsBodySchema = withMeasurementWindowValidation(
  measurementWindowBaseSchema.merge(scopeFilterSchema),
);
export type ComputeStockoutsInput = z.infer<typeof computeStockoutsBodySchema>;

export const listStockoutIncidentsQuerySchema = scopeFilterSchema;

export const computeFillRateBodySchema = withMeasurementWindowValidation(
  measurementWindowBaseSchema.merge(scopeFilterSchema),
);
export type ComputeFillRateInput = z.infer<typeof computeFillRateBodySchema>;

export const listFillRateMeasurementsQuerySchema = scopeFilterSchema;

export const computeForecastErrorBodySchema = withMeasurementWindowValidation(
  measurementWindowBaseSchema.merge(
    scopeFilterSchema.extend({
      forecastJobId: z.string().uuid().optional(),
    }),
  ),
);
export type ComputeForecastErrorInput = z.infer<typeof computeForecastErrorBodySchema>;

export const listForecastErrorMeasurementsQuerySchema = scopeFilterSchema.extend({
  forecastJobId: z.string().uuid().optional(),
});

export const computeDecisionOutcomesBodySchema = withMeasurementWindowValidation(
  measurementWindowBaseSchema.extend({
    decisionId: z.string().uuid().optional(),
    decisionIds: z.array(z.string().uuid()).min(1).optional(),
  }),
);
export type ComputeDecisionOutcomesInput = z.infer<typeof computeDecisionOutcomesBodySchema>;

export const listDecisionOutcomesQuerySchema = z.object({
  decisionId: z.string().uuid().optional(),
  outcomeStatus: z.nativeEnum(DecisionOutcomeStatus).optional(),
});

export const computePolicyEffectivenessBodySchema = withMeasurementWindowValidation(
  measurementWindowBaseSchema.extend({
    policyId: z.string().uuid().optional(),
  }),
);
export type ComputePolicyEffectivenessInput = z.infer<typeof computePolicyEffectivenessBodySchema>;

export const listPolicyEffectivenessSummariesQuerySchema = z.object({
  policyId: z.string().uuid().optional(),
});

export interface StockoutIncidentDto {
  id: string;
  organizationId: string;
  skuId: string;
  locationId: string;
  detectedAt: string;
  incidentStartAt: string;
  incidentEndAt: string | null;
  severity: string | null;
  sourceType: string;
  sourceReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FillRateMeasurementDto {
  id: string;
  organizationId: string;
  skuId: string | null;
  locationId: string | null;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  orderedQty: number;
  fulfilledQty: number;
  fillRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastErrorMeasurementDto {
  id: string;
  organizationId: string;
  forecastJobId: string | null;
  skuId: string;
  locationId: string | null;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  actualQty: number;
  forecastQty: number;
  absoluteError: number;
  percentageError: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryCostSnapshotDto {
  id: string;
  organizationId: string;
  skuId: string | null;
  locationId: string | null;
  snapshotAt: string;
  holdingCostEstimate: number | null;
  expediteCostEstimate: number | null;
  carryingDays: number | null;
  metadata: unknown;
  createdAt: string;
}

export interface DecisionOutcomeDto {
  id: string;
  organizationId: string;
  decisionId: string;
  executionTaskId: string | null;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  outcomeStatus: DecisionOutcomeStatus;
  stockoutAvoided: boolean | null;
  fillRateDelta: number | null;
  inventoryDaysDelta: number | null;
  holdingCostDelta: number | null;
  expediteCostDelta: number | null;
  summaryJson: unknown;
  computedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyEffectivenessSummaryDto {
  id: string;
  organizationId: string;
  policyId: string;
  policyVersion: number;
  scopeType: OutcomeScopeType;
  scopeReference: string | null;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  decisionCount: number;
  executedDecisionCount: number;
  stockoutAvoidanceRate: number | null;
  averageFillRateDelta: number | null;
  averageForecastError: number | null;
  overrideRate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockoutComputationResultDto {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  computedCount: number;
  incidents: StockoutIncidentDto[];
}

export interface FillRateComputationResultDto {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  computedCount: number;
  measurements: FillRateMeasurementDto[];
}

export interface ForecastErrorComputationResultDto {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  computedCount: number;
  measurements: ForecastErrorMeasurementDto[];
}

export interface DecisionOutcomeComputationResultDto {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  computedCount: number;
  outcomes: DecisionOutcomeDto[];
}

export interface PolicyEffectivenessComputationResultDto {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  computedCount: number;
  summaries: PolicyEffectivenessSummaryDto[];
}

export interface OutcomesProcessingSummaryDto {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  stockoutCount: number;
  fillRateCount: number;
  forecastErrorCount: number;
  decisionOutcomeCount: number;
  policySummaryCount: number;
}

const jsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(jsonValueSchema);
