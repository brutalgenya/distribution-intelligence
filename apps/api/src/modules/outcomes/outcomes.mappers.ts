import type {
  DecisionOutcome,
  FillRateMeasurement,
  ForecastErrorMeasurement,
  InventoryCostSnapshot,
  PolicyEffectivenessSummary,
  StockoutIncident,
} from "@prisma/client";

import type {
  DecisionOutcomeDto,
  FillRateMeasurementDto,
  ForecastErrorMeasurementDto,
  InventoryCostSnapshotDto,
  PolicyEffectivenessSummaryDto,
  StockoutIncidentDto,
} from "./outcomes.schemas.js";

export const toStockoutIncidentDto = (incident: StockoutIncident): StockoutIncidentDto => ({
  id: incident.id,
  organizationId: incident.organizationId,
  skuId: incident.skuId,
  locationId: incident.locationId,
  detectedAt: incident.detectedAt.toISOString(),
  incidentStartAt: incident.incidentStartAt.toISOString(),
  incidentEndAt: incident.incidentEndAt?.toISOString() ?? null,
  severity: incident.severity ?? null,
  sourceType: incident.sourceType,
  sourceReference: incident.sourceReference ?? null,
  createdAt: incident.createdAt.toISOString(),
  updatedAt: incident.updatedAt.toISOString(),
});

export const toFillRateMeasurementDto = (
  measurement: FillRateMeasurement,
): FillRateMeasurementDto => ({
  id: measurement.id,
  organizationId: measurement.organizationId,
  skuId: measurement.skuId,
  locationId: measurement.locationId,
  measurementWindowStart: measurement.measurementWindowStart.toISOString(),
  measurementWindowEnd: measurement.measurementWindowEnd.toISOString(),
  orderedQty: measurement.orderedQty,
  fulfilledQty: measurement.fulfilledQty,
  fillRate: measurement.fillRate,
  createdAt: measurement.createdAt.toISOString(),
  updatedAt: measurement.updatedAt.toISOString(),
});

export const toForecastErrorMeasurementDto = (
  measurement: ForecastErrorMeasurement,
): ForecastErrorMeasurementDto => ({
  id: measurement.id,
  organizationId: measurement.organizationId,
  forecastJobId: measurement.forecastJobId,
  skuId: measurement.skuId,
  locationId: measurement.locationId,
  measurementWindowStart: measurement.measurementWindowStart.toISOString(),
  measurementWindowEnd: measurement.measurementWindowEnd.toISOString(),
  actualQty: measurement.actualQty,
  forecastQty: measurement.forecastQty,
  absoluteError: measurement.absoluteError,
  percentageError: measurement.percentageError ?? null,
  createdAt: measurement.createdAt.toISOString(),
  updatedAt: measurement.updatedAt.toISOString(),
});

export const toInventoryCostSnapshotDto = (
  snapshot: InventoryCostSnapshot,
): InventoryCostSnapshotDto => ({
  id: snapshot.id,
  organizationId: snapshot.organizationId,
  skuId: snapshot.skuId,
  locationId: snapshot.locationId,
  snapshotAt: snapshot.snapshotAt.toISOString(),
  holdingCostEstimate: snapshot.holdingCostEstimate ?? null,
  expediteCostEstimate: snapshot.expediteCostEstimate ?? null,
  carryingDays: snapshot.carryingDays ?? null,
  metadata: snapshot.metadata,
  createdAt: snapshot.createdAt.toISOString(),
});

export const toDecisionOutcomeDto = (outcome: DecisionOutcome): DecisionOutcomeDto => ({
  id: outcome.id,
  organizationId: outcome.organizationId,
  decisionId: outcome.decisionId,
  executionTaskId: outcome.executionTaskId ?? null,
  measurementWindowStart: outcome.measurementWindowStart.toISOString(),
  measurementWindowEnd: outcome.measurementWindowEnd.toISOString(),
  outcomeStatus: outcome.outcomeStatus,
  stockoutAvoided: outcome.stockoutAvoided ?? null,
  fillRateDelta: outcome.fillRateDelta ?? null,
  inventoryDaysDelta: outcome.inventoryDaysDelta ?? null,
  holdingCostDelta: outcome.holdingCostDelta ?? null,
  expediteCostDelta: outcome.expediteCostDelta ?? null,
  summaryJson: outcome.summaryJson,
  computedAt: outcome.computedAt.toISOString(),
  createdAt: outcome.createdAt.toISOString(),
  updatedAt: outcome.updatedAt.toISOString(),
});

export const toPolicyEffectivenessSummaryDto = (
  summary: PolicyEffectivenessSummary,
): PolicyEffectivenessSummaryDto => ({
  id: summary.id,
  organizationId: summary.organizationId,
  policyId: summary.policyId,
  policyVersion: summary.policyVersion,
  scopeType: summary.scopeType,
  scopeReference: summary.scopeReference ?? null,
  measurementWindowStart: summary.measurementWindowStart.toISOString(),
  measurementWindowEnd: summary.measurementWindowEnd.toISOString(),
  decisionCount: summary.decisionCount,
  executedDecisionCount: summary.executedDecisionCount,
  stockoutAvoidanceRate: summary.stockoutAvoidanceRate ?? null,
  averageFillRateDelta: summary.averageFillRateDelta ?? null,
  averageForecastError: summary.averageForecastError ?? null,
  overrideRate: summary.overrideRate ?? null,
  createdAt: summary.createdAt.toISOString(),
  updatedAt: summary.updatedAt.toISOString(),
});
