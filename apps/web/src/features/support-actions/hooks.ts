import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { decisionInboxKeys } from "../decisions/query-keys";
import { dataOpsKeys } from "../data-ops/query-keys";
import { investigationKeys } from "../investigation/query-keys";
import { outcomesDashboardKeys } from "../outcomes/query-keys";
import { useSession } from "../session/SessionProvider";
import { workflowQueueKeys } from "../workflow/query-keys";
import {
  cancelExecutionTask,
  createIntegrationSyncRun,
  getForecastJob,
  getIntegrationSyncRun,
  getSupportExecution,
  listExecutionAttempts,
  listForecastResults,
  listIntegrationConnections,
  listIntegrationFailedRecords,
  listIntegrationSyncRuns,
  listSupportExecutions,
  listSupportForecastJobs,
  listWorkerStatus,
  processForecastJob,
  processIntegrationSyncRun,
  recomputeOutcomes,
  requeueExecutionTask,
  requeueForecastJob,
} from "./api";
import { supportActionsKeys } from "./query-keys";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const invalidateOperationalQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  const queryKeys = [
    supportActionsKeys.all,
    workflowQueueKeys.all,
    dataOpsKeys.all,
    investigationKeys.all,
    outcomesDashboardKeys.all,
    decisionInboxKeys.all,
  ] as const;

  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
  );
};

export const useSupportActionsExecutions = (
  filters: { status?: string; decisionId?: string; from?: string; to?: string; limit?: number } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supportActionsKeys.executions(session.userId, session.organizationId, filters),
    queryFn: () => listSupportExecutions(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useSupportActionsExecutionDetail = (executionTaskId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      executionTaskId === null
        ? supportActionsKeys.executionDetail(session.userId, session.organizationId, "unselected")
        : supportActionsKeys.executionDetail(session.userId, session.organizationId, executionTaskId),
    queryFn: () => getSupportExecution(apiClient, executionTaskId as string),
    enabled: session.queryEnabled && executionTaskId !== null,
  });
};

export const useSupportActionsExecutionAttempts = (executionTaskId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      executionTaskId === null
        ? supportActionsKeys.executionAttempts(session.userId, session.organizationId, "unselected")
        : supportActionsKeys.executionAttempts(session.userId, session.organizationId, executionTaskId),
    queryFn: () => listExecutionAttempts(apiClient, executionTaskId as string),
    enabled: session.queryEnabled && executionTaskId !== null,
  });
};

export const useSupportActionsForecastJobs = (
  filters: { status?: string; from?: string; to?: string; limit?: number } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supportActionsKeys.forecastJobs(session.userId, session.organizationId, filters),
    queryFn: () => listSupportForecastJobs(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useSupportActionsForecastJobDetail = (forecastJobId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      forecastJobId === null
        ? supportActionsKeys.forecastJobDetail(session.userId, session.organizationId, "unselected")
        : supportActionsKeys.forecastJobDetail(session.userId, session.organizationId, forecastJobId),
    queryFn: () => getForecastJob(apiClient, forecastJobId as string),
    enabled: session.queryEnabled && forecastJobId !== null,
  });
};

export const useSupportActionsForecastResults = (forecastJobId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      forecastJobId === null
        ? supportActionsKeys.forecastResults(session.userId, session.organizationId, "unselected")
        : supportActionsKeys.forecastResults(session.userId, session.organizationId, forecastJobId),
    queryFn: () => listForecastResults(apiClient, forecastJobId as string),
    enabled: session.queryEnabled && forecastJobId !== null,
  });
};

export const useSupportActionsConnections = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supportActionsKeys.connections(session.userId, session.organizationId),
    queryFn: () => listIntegrationConnections(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useSupportActionsSyncRuns = (
  filters: { integrationConnectionId?: string | null; status?: string } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supportActionsKeys.syncRuns(session.userId, session.organizationId, filters),
    queryFn: () => listIntegrationSyncRuns(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useSupportActionsSyncRunDetail = (syncRunId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      syncRunId === null
        ? supportActionsKeys.syncRunDetail(session.userId, session.organizationId, "unselected")
        : supportActionsKeys.syncRunDetail(session.userId, session.organizationId, syncRunId),
    queryFn: () => getIntegrationSyncRun(apiClient, syncRunId as string),
    enabled: session.queryEnabled && syncRunId !== null,
  });
};

export const useSupportActionsFailedRecords = (
  filters: { integrationConnectionId?: string | null; syncRunId?: string | null; resolved?: boolean } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supportActionsKeys.failedRecords(session.userId, session.organizationId, filters),
    queryFn: () => listIntegrationFailedRecords(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useSupportActionsWorkerStatus = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supportActionsKeys.workerStatus(session.userId, session.organizationId),
    queryFn: () => listWorkerStatus(apiClient),
    enabled: session.queryEnabled,
    staleTime: 30_000,
  });
};

export const useSupportExecutionRequeueMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { executionTaskId: string; reason?: string }) =>
      requeueExecutionTask(apiClient, input.executionTaskId, input.reason),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useSupportExecutionCancelMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { executionTaskId: string; reason?: string }) =>
      cancelExecutionTask(apiClient, input.executionTaskId, input.reason),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useSupportForecastRequeueMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { forecastJobId: string; reason?: string }) =>
      requeueForecastJob(apiClient, input.forecastJobId, input.reason),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useSupportForecastProcessMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { forecastJobId: string }) =>
      processForecastJob(apiClient, input.forecastJobId),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useSupportSyncCreateMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      connectionId: string;
      direction: "inbound" | "outbound";
      syncType: "catalog_import" | "demand_import" | "inventory_import";
    }) => createIntegrationSyncRun(apiClient, input),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useSupportSyncProcessMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { syncRunId: string }) =>
      processIntegrationSyncRun(apiClient, input.syncRunId),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useSupportOutcomeRecomputeMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { measurementWindowStart: string; measurementWindowEnd: string }) =>
      recomputeOutcomes(apiClient, input),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};
