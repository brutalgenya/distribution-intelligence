import type { MetricCardItem } from "../outcomes/types";
import type { WorkerStatus } from "../workflow/types";

export interface DataOpsContextParams {
  skuId: string | null;
  locationId: string | null;
  forecastJobId: string | null;
  integrationConnectionId: string | null;
  syncRunId: string | null;
}

export type IntegrationType = "erp" | "wms" | "csv_import" | "manual_bridge";
export type IntegrationConnectionStatus = "active" | "inactive" | "error";
export type IntegrationDirection = "inbound" | "outbound";
export type IntegrationSyncType = "catalog_import" | "demand_import" | "inventory_import";
export type IntegrationSyncStatus = "pending" | "running" | "completed" | "failed" | "partial";

export interface IntegrationConnection {
  id: string;
  organizationId: string;
  integrationType: IntegrationType;
  name: string;
  status: IntegrationConnectionStatus;
  configJson: unknown;
  credentialsRef: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncRun {
  id: string;
  organizationId: string;
  integrationConnectionId: string;
  requestedByUserId: string | null;
  direction: IntegrationDirection;
  syncType: IntegrationSyncType;
  status: IntegrationSyncStatus;
  startedAt: string;
  completedAt: string | null;
  processedCount: number;
  successCount: number;
  failureCount: number;
  checkpoint: unknown;
  errorSummary: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationFailedRecord {
  id: string;
  organizationId: string;
  integrationConnectionId: string;
  syncRunId: string | null;
  recordType: string;
  sourceReference: string | null;
  payload: unknown;
  errorMessage: string;
  createdAt: string;
  resolvedAt: string | null;
}

export type ForecastJobStatus = "pending" | "running" | "completed" | "failed";
export type ForecastScopeType = "sku" | "sku_location" | "organization";
export type ForecastModelType = "baseline_recent_average";

export interface ForecastJob {
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

export interface ForecastResult {
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

export type SalesImportRunStatus = "completed" | "failed";

export interface SalesImportRun {
  id: string;
  organizationId: string;
  status: SalesImportRunStatus;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  rejectedRows: number;
  errorSummary: unknown;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomerOrderStatus = "open" | "cancelled";

export interface CustomerOrderLine {
  id: string;
  skuId: string;
  locationId: string;
  quantity: number;
  unitPrice: number | null;
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  organizationId: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  customerReference: string | null;
  orderedAt: string;
  createdByUserId: string;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lines: CustomerOrderLine[];
}

export type AiRunType = "forecast_enhancement" | "anomaly_scoring" | "decision_explanation";
export type AiRunStatus = "pending" | "succeeded" | "failed" | "degraded";
export type AiModelType = "forecast_enhancement" | "anomaly_scoring" | "decision_explanation";

export interface AiRun {
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

export type AnomalySeverity = "low" | "medium" | "high";

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

export interface DataOpsHealthSummary {
  cards: MetricCardItem[];
  freshness: Array<{ id: string; label: string; value: string; helper: string }>;
}

export interface ConnectionRow extends IntegrationConnection {
  latestSyncRun: IntegrationSyncRun | null;
  lastSuccessfulSyncAt: string | null;
}

export interface ForecastJobRow extends ForecastJob {
  scopeLabel: string;
  isContextMatch: boolean;
}

export interface MatchedDemandEvidence {
  order: CustomerOrder;
  matchedQuantity: number;
}

export interface DataOpsDiagnosticsSummary {
  workerStatuses: WorkerStatus[];
  unresolvedFailedRecords: IntegrationFailedRecord[];
}
