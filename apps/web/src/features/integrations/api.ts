import type { ApiClient } from "../../lib/api/types";
import type {
  CreateIntegrationConnectionInput,
  CreateIntegrationSyncRunInput,
  IntegrationConnection,
  IntegrationConnectionFilters,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  UpdateIntegrationConnectionInput,
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

export const listIntegrationConnections = (
  apiClient: ApiClient,
  filters: Pick<IntegrationConnectionFilters, "integrationType" | "status">,
): Promise<IntegrationConnection[]> =>
  apiClient.get(
    `/integrations/connections${buildQueryString({
      integrationType: filters.integrationType !== "all" ? filters.integrationType : undefined,
      status: filters.status !== "all" ? filters.status : undefined,
    })}`,
  );

export const getIntegrationConnection = (
  apiClient: ApiClient,
  integrationConnectionId: string,
): Promise<IntegrationConnection> =>
  apiClient.get(`/integrations/connections/${integrationConnectionId}`);

export const createIntegrationConnection = (
  apiClient: ApiClient,
  input: CreateIntegrationConnectionInput,
): Promise<IntegrationConnection> =>
  apiClient.post("/integrations/connections", input);

export const updateIntegrationConnection = (
  apiClient: ApiClient,
  integrationConnectionId: string,
  input: UpdateIntegrationConnectionInput,
): Promise<IntegrationConnection> =>
  apiClient.patch(`/integrations/connections/${integrationConnectionId}`, input);

export const listIntegrationSyncRuns = (
  apiClient: ApiClient,
): Promise<IntegrationSyncRun[]> => apiClient.get("/integrations/syncs");

export const getIntegrationSyncRun = (
  apiClient: ApiClient,
  syncRunId: string,
): Promise<IntegrationSyncRun> => apiClient.get(`/integrations/syncs/${syncRunId}`);

export const createIntegrationSyncRun = (
  apiClient: ApiClient,
  input: CreateIntegrationSyncRunInput,
): Promise<IntegrationSyncRun> => apiClient.post("/integrations/syncs", input);

export const processIntegrationSyncRun = (
  apiClient: ApiClient,
  syncRunId: string,
): Promise<IntegrationSyncRun> => apiClient.post(`/integrations/syncs/${syncRunId}/process`);

export const listIntegrationFailedRecords = (
  apiClient: ApiClient,
  filters: { resolved?: boolean },
): Promise<IntegrationFailedRecord[]> =>
  apiClient.get(
    `/integrations/failed-records${buildQueryString({
      resolved: filters.resolved !== undefined ? String(filters.resolved) : undefined,
    })}`,
  );
