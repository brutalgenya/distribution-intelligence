import type { ApiClient } from "../../lib/api/types";
import type {
  AiRun,
  AnomalyScore,
  CustomerOrder,
  DataOpsContextParams,
  ForecastJob,
  ForecastResult,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  SalesImportRun,
} from "./types";
import type { WorkerStatus } from "../workflow/types";

const buildQueryString = (filters: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
};

export const listIntegrationConnections = (apiClient: ApiClient): Promise<IntegrationConnection[]> =>
  apiClient.get("/integrations/connections");

export const getIntegrationConnection = (
  apiClient: ApiClient,
  integrationConnectionId: string,
): Promise<IntegrationConnection> => apiClient.get(`/integrations/connections/${integrationConnectionId}`);

export const listIntegrationSyncRuns = (
  apiClient: ApiClient,
  filters: { integrationConnectionId?: string | null },
): Promise<IntegrationSyncRun[]> =>
  apiClient.get(
    `/integrations/syncs${buildQueryString({
      connectionId: filters.integrationConnectionId ?? undefined,
    })}`,
  );

export const getIntegrationSyncRun = (
  apiClient: ApiClient,
  syncRunId: string,
): Promise<IntegrationSyncRun> => apiClient.get(`/integrations/syncs/${syncRunId}`);

export const listIntegrationFailedRecords = (
  apiClient: ApiClient,
  filters: { integrationConnectionId?: string | null; syncRunId?: string | null; resolved?: boolean },
): Promise<IntegrationFailedRecord[]> =>
  apiClient.get(
    `/integrations/failed-records${buildQueryString({
      connectionId: filters.integrationConnectionId ?? undefined,
      syncRunId: filters.syncRunId ?? undefined,
      resolved: filters.resolved !== undefined ? String(filters.resolved) : undefined,
    })}`,
  );

export const listSupportForecastJobs = (apiClient: ApiClient): Promise<ForecastJob[]> =>
  apiClient.get(
    `/support/forecast-jobs${buildQueryString({
      limit: "50",
    })}`,
  );

export const getForecastJob = (apiClient: ApiClient, forecastJobId: string): Promise<ForecastJob> =>
  apiClient.get(`/forecasting/jobs/${forecastJobId}`);

export const listForecastResults = (
  apiClient: ApiClient,
  forecastJobId: string,
): Promise<ForecastResult[]> => apiClient.get(`/forecasting/jobs/${forecastJobId}/results`);

export const listSalesImportRuns = (apiClient: ApiClient): Promise<SalesImportRun[]> =>
  apiClient.get("/demand/sales/import-runs");

export const listCustomerOrders = (apiClient: ApiClient): Promise<CustomerOrder[]> =>
  apiClient.get("/demand/orders");

export const listSupportAiRuns = (apiClient: ApiClient): Promise<AiRun[]> =>
  apiClient.get(
    `/support/ai-runs${buildQueryString({
      limit: "50",
    })}`,
  );

export const listAnomalyScores = (
  apiClient: ApiClient,
  filters: Pick<DataOpsContextParams, "skuId" | "locationId">,
): Promise<AnomalyScore[]> =>
  apiClient.get(
    `/ai/anomalies${buildQueryString({
      skuId: filters.skuId ?? undefined,
      locationId: filters.locationId ?? undefined,
    })}`,
  );

export const listWorkerStatus = (apiClient: ApiClient): Promise<WorkerStatus[]> =>
  apiClient.get("/support/worker-status");
