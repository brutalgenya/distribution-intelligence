import type { ModelRegistryEntry } from "@prisma/client";

import type { AiRunWithModel } from "./ai-run.repository.js";
import type { AnomalyScoreWithRelations } from "./anomaly-score.repository.js";
import type { DecisionExplanationWithRelations } from "./decision-explanation.repository.js";
import type { EnhancedForecastResultWithRelations } from "./enhanced-forecast-result.repository.js";
import type {
  AiRunDto,
  AnomalyScoreDto,
  DecisionExplanationDto,
  EnhancedForecastResultDto,
  ModelRegistryEntryDto,
} from "./ai.schemas.js";

export const toModelRegistryEntryDto = (entry: ModelRegistryEntry): ModelRegistryEntryDto => ({
  id: entry.id,
  provider: entry.provider,
  modelName: entry.modelName,
  modelVersion: entry.modelVersion,
  modelType: entry.modelType,
  promptVersion: entry.promptVersion,
  schemaVersion: entry.schemaVersion,
  status: entry.status,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
});

export const toAiRunDto = (run: AiRunWithModel): AiRunDto => ({
  id: run.id,
  organizationId: run.organizationId,
  modelRegistryEntryId: run.modelRegistryEntryId,
  provider: run.modelRegistryEntry.provider,
  modelName: run.modelRegistryEntry.modelName,
  modelVersion: run.modelRegistryEntry.modelVersion,
  modelType: run.modelRegistryEntry.modelType,
  promptVersion: run.modelRegistryEntry.promptVersion,
  runType: run.runType,
  status: run.status,
  subjectType: run.subjectType,
  subjectReference: run.subjectReference,
  inputChecksum: run.inputChecksum,
  inputPayload: run.inputPayload,
  outputPayload: run.outputPayload,
  errorMessage: run.errorMessage,
  latencyMs: run.latencyMs,
  createdAt: run.createdAt.toISOString(),
  completedAt: run.completedAt?.toISOString() ?? null,
});

export const toEnhancedForecastResultDto = (
  result: EnhancedForecastResultWithRelations,
): EnhancedForecastResultDto => ({
  id: result.id,
  organizationId: result.organizationId,
  forecastJobId: result.forecastJobId,
  aiRunId: result.aiRunId,
  modelRegistryEntryId: result.modelRegistryEntryId,
  provider: result.modelRegistryEntry.provider,
  modelName: result.modelRegistryEntry.modelName,
  modelVersion: result.modelRegistryEntry.modelVersion,
  skuId: result.skuId,
  locationId: result.locationId,
  forecastDate: result.forecastDate.toISOString(),
  baselineForecastQty: result.baselineForecastQty,
  enhancedForecastQty: result.enhancedForecastQty,
  confidenceLow: result.confidenceLow,
  confidenceHigh: result.confidenceHigh,
  createdAt: result.createdAt.toISOString(),
  updatedAt: result.updatedAt.toISOString(),
});

export const toAnomalyScoreDto = (score: AnomalyScoreWithRelations): AnomalyScoreDto => ({
  id: score.id,
  organizationId: score.organizationId,
  aiRunId: score.aiRunId,
  modelRegistryEntryId: score.modelRegistryEntryId,
  provider: score.modelRegistryEntry.provider,
  modelName: score.modelRegistryEntry.modelName,
  modelVersion: score.modelRegistryEntry.modelVersion,
  subjectType: score.subjectType,
  subjectReference: score.subjectReference,
  measurementWindowStart: score.measurementWindowStart.toISOString(),
  measurementWindowEnd: score.measurementWindowEnd.toISOString(),
  anomalyScore: score.anomalyScore,
  severity: score.severity,
  explanationSummary: score.explanationSummary,
  payload: score.payload,
  createdAt: score.createdAt.toISOString(),
  updatedAt: score.updatedAt.toISOString(),
});

export const toDecisionExplanationDto = (
  explanation: DecisionExplanationWithRelations,
): DecisionExplanationDto => ({
  id: explanation.id,
  organizationId: explanation.organizationId,
  decisionId: explanation.decisionId,
  aiRunId: explanation.aiRunId,
  modelRegistryEntryId: explanation.modelRegistryEntryId,
  provider: explanation.modelRegistryEntry.provider,
  modelName: explanation.modelRegistryEntry.modelName,
  modelVersion: explanation.modelRegistryEntry.modelVersion,
  summary: explanation.summary,
  explanationJson: explanation.explanationJson,
  createdAt: explanation.createdAt.toISOString(),
  updatedAt: explanation.updatedAt.toISOString(),
});
