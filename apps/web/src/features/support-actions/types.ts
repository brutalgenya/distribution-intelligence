import type {
  ForecastJob,
  ForecastResult,
  IntegrationConnection,
  IntegrationDirection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  IntegrationSyncType,
} from "../data-ops/types";
import type {
  SupportExecutionAttempt,
  SupportExecutionTask,
  WorkerStatus,
} from "../workflow/types";

export type {
  ForecastJob,
  ForecastResult,
  IntegrationConnection,
  IntegrationDirection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  IntegrationSyncType,
  SupportExecutionAttempt,
  SupportExecutionTask,
  WorkerStatus,
};

export interface SupportActionsRouteParams {
  executionId: string | null;
  forecastJobId: string | null;
  integrationConnectionId: string | null;
  syncRunId: string | null;
  skuId: string | null;
  locationId: string | null;
}

export interface OutcomeRecomputeResult {
  measurementWindowStart: string;
  measurementWindowEnd: string;
  stockoutCount: number;
  fillRateCount: number;
  forecastErrorCount: number;
  decisionOutcomeCount: number;
  policySummaryCount: number;
}

export interface ForecastJobProcessingResult {
  job: ForecastJob;
  results: ForecastResult[];
  processedNow: boolean;
  enhancementStatus?: string | null;
  enhancementRun?: unknown | null;
  enhancedResults?: unknown[] | null;
  baselineFallbackUsed?: boolean;
}

export type SupportActionSourceType = "execution" | "forecast" | "sync" | "failed_record";

export interface SupportActionableItem {
  key: string;
  sourceType: SupportActionSourceType;
  entityId: string;
  title: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string | null;
  errorSummary: string | null;
  primaryReference: string;
  secondaryReference: string | null;
  availableActionLabel: string | null;
  unsupportedReason: string | null;
  executionId: string | null;
  forecastJobId: string | null;
  integrationConnectionId: string | null;
  syncRunId: string | null;
  skuId: string | null;
  locationId: string | null;
}

export interface SupportActionSummaryCard {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: "critical" | "warning" | "positive" | "neutral";
}

export interface SupportActionFeedback {
  id: string;
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
}
