import type { ForecastJob, ForecastResult } from "@prisma/client";

import type { ForecastJobDto, ForecastResultDto } from "./forecasting.schemas.js";

export const toForecastJobDto = (job: ForecastJob): ForecastJobDto => ({
  id: job.id,
  organizationId: job.organizationId,
  status: job.status,
  requestedByUserId: job.requestedByUserId,
  scopeType: job.scopeType,
  scopeReference: job.scopeReference,
  horizonDays: job.horizonDays,
  modelType: job.modelType,
  inputSnapshot: job.inputSnapshot,
  errorMessage: job.errorMessage,
  createdAt: job.createdAt.toISOString(),
  startedAt: job.startedAt?.toISOString() ?? null,
  completedAt: job.completedAt?.toISOString() ?? null,
});

export const toForecastResultDto = (result: ForecastResult): ForecastResultDto => ({
  id: result.id,
  organizationId: result.organizationId,
  forecastJobId: result.forecastJobId,
  skuId: result.skuId,
  locationId: result.locationId,
  forecastDate: result.forecastDate.toISOString(),
  forecastQty: result.forecastQty,
  confidenceLow: result.confidenceLow,
  confidenceHigh: result.confidenceHigh,
  modelType: result.modelType,
  createdAt: result.createdAt.toISOString(),
});
