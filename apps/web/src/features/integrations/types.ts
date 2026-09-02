import type {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationDirection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  IntegrationSyncStatus,
  IntegrationSyncType,
  IntegrationType,
} from "../data-ops/types";
import type { MetricCardItem, MetricTone } from "../outcomes/types";

export type {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationDirection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  IntegrationSyncStatus,
  IntegrationSyncType,
  IntegrationType,
};

export interface IntegrationsRouteParams {
  integrationConnectionId: string | null;
  syncRunId: string | null;
  status: IntegrationConnectionStatus | "all";
  integrationType: IntegrationType | "all";
  search: string;
}

export interface IntegrationConnectionFilters {
  status: IntegrationConnectionStatus | "all";
  integrationType: IntegrationType | "all";
  search: string;
}

export interface ConnectionRow extends IntegrationConnection {
  latestSyncRun: IntegrationSyncRun | null;
  lastSuccessfulSyncAt: string | null;
  unresolvedFailedRecordCount: number;
}

export interface OnboardingReadinessSummary {
  statusLabel: string;
  tone: MetricTone;
  helper: string;
  cards: MetricCardItem[];
}

export interface SafeConfigField {
  label: string;
  value: string;
}

export interface ConnectionEditorState {
  integrationType: IntegrationType;
  name: string;
  status: IntegrationConnectionStatus;
  credentialsRef: string;
  endpointBaseUrl: string;
  externalSystemCode: string;
  warehouseGroup: string;
  delimiter: string;
  hasHeaderRow: boolean;
  sourceLabel: string;
}

export interface CreateIntegrationConnectionInput {
  integrationType: IntegrationType;
  name: string;
  status: IntegrationConnectionStatus;
  configJson: unknown;
  credentialsRef?: string;
}

export interface UpdateIntegrationConnectionInput {
  name?: string;
  status?: IntegrationConnectionStatus;
  configJson?: unknown;
  credentialsRef?: string | null;
}

export interface SyncRunCreateDraft {
  connectionId: string;
  direction: IntegrationDirection;
  syncType: IntegrationSyncType;
  inputPayloadText: string;
}

export interface CreateIntegrationSyncRunInput {
  connectionId: string;
  direction: IntegrationDirection;
  syncType: IntegrationSyncType;
  inputPayload?: unknown;
}

export interface IntegrationActionFeedback {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
}
