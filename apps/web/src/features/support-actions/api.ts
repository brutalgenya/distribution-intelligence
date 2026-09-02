import type { ApiClient } from "../../lib/api/types";
import type {
  ForecastJob,
  ForecastJobProcessingResult,
  ForecastResult,
  IntegrationConnection,
  IntegrationDirection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  IntegrationSyncType,
  OutcomeRecomputeResult,
  SupportExecutionAttempt,
  SupportExecutionTask,
  WorkerStatus,
} from "./types";

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

const toIsoBoundary = (value: string | undefined, boundary: "start" | "end"): string | undefined => {
  if (!value) {
    return undefined;
  }

  return boundary === "start"
    ? new Date(`${value}T00:00:00.000Z`).toISOString()
    : new Date(`${value}T23:59:59.999Z`).toISOString();
};

export const listSupportExecutions = (
  apiClient: ApiClient,
  filters: { status?: string; decisionId?: string; from?: string; to?: string; limit?: number } = {},
): Promise<SupportExecutionTask[]> =>
  apiClient.get(
    `/support/executions${buildQueryString({
      status: filters.status,
      decisionId: filters.decisionId,
      from: toIsoBoundary(filters.from, "start"),
      to: toIsoBoundary(filters.to, "end"),
      limit: String(filters.limit ?? 100),
    })}`,
  );

export const getSupportExecution = (
  apiClient: ApiClient,
  executionTaskId: string,
): Promise<SupportExecutionTask> => apiClient.get(`/support/executions/${executionTaskId}`);

export const listExecutionAttempts = (
  apiClient: ApiClient,
  executionTaskId: string,
): Promise<SupportExecutionAttempt[]> => apiClient.get(`/support/executions/${executionTaskId}/attempts`);

export const listSupportForecastJobs = (
  apiClient: ApiClient,
  filters: { status?: string; from?: string; to?: string; limit?: number } = {},
): Promise<ForecastJob[]> =>
  apiClient.get(
    `/support/forecast-jobs${buildQueryString({
      status: filters.status,
      from: toIsoBoundary(filters.from, "start"),
      to: toIsoBoundary(filters.to, "end"),
      limit: String(filters.limit ?? 100),
    })}`,
  );

export const getForecastJob = (
  apiClient: ApiClient,
  forecastJobId: string,
): Promise<ForecastJob> => apiClient.get(`/forecasting/jobs/${forecastJobId}`);

export const listForecastResults = (
  apiClient: ApiClient,
  forecastJobId: string,
): Promise<ForecastResult[]> => apiClient.get(`/forecasting/jobs/${forecastJobId}/results`);

export const listIntegrationConnections = (
  apiClient: ApiClient,
): Promise<IntegrationConnection[]> => apiClient.get("/integrations/connections");

export const listIntegrationSyncRuns = (
  apiClient: ApiClient,
  filters: { integrationConnectionId?: string | null; status?: string } = {},
): Promise<IntegrationSyncRun[]> =>
  apiClient.get(
    `/integrations/syncs${buildQueryString({
      connectionId: filters.integrationConnectionId ?? undefined,
      status: filters.status,
    })}`,
  );

export const getIntegrationSyncRun = (
  apiClient: ApiClient,
  syncRunId: string,
): Promise<IntegrationSyncRun> => apiClient.get(`/integrations/syncs/${syncRunId}`);

export const listIntegrationFailedRecords = (
  apiClient: ApiClient,
  filters: { integrationConnectionId?: string | null; syncRunId?: string | null; resolved?: boolean } = {},
): Promise<IntegrationFailedRecord[]> =>
  apiClient.get(
    `/integrations/failed-records${buildQueryString({
      connectionId: filters.integrationConnectionId ?? undefined,
      syncRunId: filters.syncRunId ?? undefined,
      resolved: filters.resolved === undefined ? undefined : String(filters.resolved),
    })}`,
  );

export const listWorkerStatus = (apiClient: ApiClient): Promise<WorkerStatus[]> =>
  apiClient.get("/support/worker-status");

export const requeueExecutionTask = (
  apiClient: ApiClient,
  executionTaskId: string,
  reason?: string,
): Promise<SupportExecutionTask> =>
  apiClient.post(`/support/executions/${executionTaskId}/requeue`, reason ? { reason } : {});

export const cancelExecutionTask = (
  apiClient: ApiClient,
  executionTaskId: string,
  reason?: string,
): Promise<SupportExecutionTask> =>
  apiClient.post(`/workflow/executions/${executionTaskId}/cancel`, reason ? { reason } : {});

export const requeueForecastJob = (
  apiClient: ApiClient,
  forecastJobId: string,
  reason?: string,
): Promise<ForecastJob> =>
  apiClient.post(`/support/forecast-jobs/${forecastJobId}/requeue`, reason ? { reason } : {});

export const processForecastJob = (
  apiClient: ApiClient,
  forecastJobId: string,
): Promise<ForecastJobProcessingResult> => apiClient.post(`/forecasting/jobs/${forecastJobId}/process`, {});

export const createIntegrationSyncRun = (
  apiClient: ApiClient,
  input: {
    connectionId: string;
    direction: IntegrationDirection;
    syncType: IntegrationSyncType;
  },
): Promise<IntegrationSyncRun> => apiClient.post("/integrations/syncs", input);

export const processIntegrationSyncRun = (
  apiClient: ApiClient,
  syncRunId: string,
): Promise<IntegrationSyncRun> => apiClient.post(`/integrations/syncs/${syncRunId}/process`, {});

export const recomputeOutcomes = (
  apiClient: ApiClient,
  input: { measurementWindowStart: string; measurementWindowEnd: string },
): Promise<OutcomeRecomputeResult> => apiClient.post("/support/outcomes/recompute", input);
