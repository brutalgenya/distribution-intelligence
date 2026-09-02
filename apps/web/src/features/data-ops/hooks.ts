import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  getForecastJob,
  getIntegrationConnection,
  getIntegrationSyncRun,
  listAnomalyScores,
  listCustomerOrders,
  listForecastResults,
  listIntegrationConnections,
  listIntegrationFailedRecords,
  listIntegrationSyncRuns,
  listSalesImportRuns,
  listSupportAiRuns,
  listSupportForecastJobs,
  listWorkerStatus,
} from "./api";
import { dataOpsKeys } from "./query-keys";
import type { DataOpsContextParams } from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const unselectedContext = {
  skuId: null,
  locationId: null,
  forecastJobId: null,
  integrationConnectionId: null,
  syncRunId: null,
} satisfies DataOpsContextParams;

export const useIntegrationConnections = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.connections(session.userId, session.organizationId),
    queryFn: () => listIntegrationConnections(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useIntegrationConnectionDetail = (integrationConnectionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      integrationConnectionId === null
        ? dataOpsKeys.connectionDetail(session.userId, session.organizationId, "unselected")
        : dataOpsKeys.connectionDetail(session.userId, session.organizationId, integrationConnectionId),
    queryFn: () => getIntegrationConnection(apiClient, integrationConnectionId as string),
    enabled: session.queryEnabled && integrationConnectionId !== null,
  });
};

export const useIntegrationSyncRuns = (filters: { integrationConnectionId?: string | null }) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.syncRuns(session.userId, session.organizationId, filters),
    queryFn: () => listIntegrationSyncRuns(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useIntegrationSyncRunDetail = (syncRunId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      syncRunId === null
        ? dataOpsKeys.syncRunDetail(session.userId, session.organizationId, "unselected")
        : dataOpsKeys.syncRunDetail(session.userId, session.organizationId, syncRunId),
    queryFn: () => getIntegrationSyncRun(apiClient, syncRunId as string),
    enabled: session.queryEnabled && syncRunId !== null,
  });
};

export const useIntegrationFailedRecords = (filters: {
  integrationConnectionId?: string | null;
  syncRunId?: string | null;
  resolved?: boolean;
}) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.failedRecords(session.userId, session.organizationId, filters),
    queryFn: () => listIntegrationFailedRecords(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useForecastJobs = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.forecastJobs(session.userId, session.organizationId),
    queryFn: () => listSupportForecastJobs(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useForecastJobDetail = (forecastJobId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      forecastJobId === null
        ? dataOpsKeys.forecastJobDetail(session.userId, session.organizationId, "unselected")
        : dataOpsKeys.forecastJobDetail(session.userId, session.organizationId, forecastJobId),
    queryFn: () => getForecastJob(apiClient, forecastJobId as string),
    enabled: session.queryEnabled && forecastJobId !== null,
  });
};

export const useForecastResults = (
  forecastJobId: string | null,
  enabled = true,
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      forecastJobId === null
        ? dataOpsKeys.forecastResults(session.userId, session.organizationId, "unselected")
        : dataOpsKeys.forecastResults(session.userId, session.organizationId, forecastJobId),
    queryFn: () => listForecastResults(apiClient, forecastJobId as string),
    enabled: session.queryEnabled && enabled && forecastJobId !== null,
  });
};

export const useSalesImportRuns = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.salesImportRuns(session.userId, session.organizationId),
    queryFn: () => listSalesImportRuns(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useDemandEvidence = (
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.customerOrders(session.userId, session.organizationId, context),
    queryFn: () => listCustomerOrders(apiClient),
    enabled: session.queryEnabled && context.skuId !== null && context.locationId !== null,
  });
};

export const useSupportAiRuns = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.aiRuns(session.userId, session.organizationId),
    queryFn: () => listSupportAiRuns(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useAnomalyScores = (
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.anomalies(session.userId, session.organizationId, context),
    queryFn: () => listAnomalyScores(apiClient, context),
    enabled: session.queryEnabled,
  });
};

export const useWorkerStatus = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: dataOpsKeys.workerStatus(session.userId, session.organizationId),
    queryFn: () => listWorkerStatus(apiClient),
    enabled: session.queryEnabled,
    staleTime: 30_000,
  });
};

export const dataOpsDefaults = {
  unselectedContext,
};
