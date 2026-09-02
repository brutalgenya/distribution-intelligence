export type SkuStatus = "active" | "inactive";

export type LocationStatus = "active" | "inactive";

export type LocationType = "warehouse" | "store" | "staging" | "transit";

export type AnomalySeverity = "low" | "medium" | "high";

export type DecisionOutcomeStatus = "pending" | "computed" | "insufficient_data";

export type OutcomeScopeType = "organization" | "sku_location";

export interface Sku {
  id: string;
  organizationId: string;
  skuCode: string;
  name: string;
  description: string | null;
  baseUom: string;
  packSize: number;
  status: SkuStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryPosition {
  id: string;
  organizationId: string;
  skuId: string;
  locationId: string;
  onHandQty: number;
  reservedQty: number;
  inTransitQty: number;
  availableToPromiseQty: number;
  safetyStockQty: number;
  reorderPointQty: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockoutIncident {
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

export interface AnomalyScore {
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

export interface FillRateMeasurement {
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

export interface ForecastErrorMeasurement {
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

export interface DecisionOutcome {
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

export interface PolicyEffectivenessSummary {
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

export type MetricTone = "critical" | "warning" | "positive" | "neutral";

export interface MetricCardItem {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: MetricTone;
  deltaLabel?: string | null;
}

export interface TrendPoint {
  label: string;
  timestamp: string;
  value: number;
}

export interface TrendCardData {
  title: string;
  subtitle: string;
  valueLabel: string;
  deltaLabel: string | null;
  series: TrendPoint[];
  emptyMessage: string;
}

export type RiskSeverity = "critical" | "high" | "medium";

export interface RiskHotspot {
  key: string;
  skuId: string;
  locationId: string;
  severity: RiskSeverity;
  scopeLabel: string;
  availableToPromiseQty: number;
  reorderPointQty: number;
  safetyStockQty: number;
  anomaly: AnomalyScore | null;
  incident: StockoutIncident | null;
  freshnessAt: string | null;
  reasons: string[];
}

export interface AnomalyHighlight {
  id: string;
  severity: AnomalySeverity;
  scopeLabel: string;
  anomalyScore: number;
  explanationSummary: string | null;
  updatedAt: string;
  measurementWindowEnd: string;
  skuId?: string | null;
  locationId?: string | null;
}
