import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { decisionInboxKeys } from "../decisions/query-keys";
import { dataOpsKeys } from "../data-ops/query-keys";
import { investigationKeys } from "../investigation/query-keys";
import { outcomesDashboardKeys } from "../outcomes/query-keys";
import { useSession } from "../session/SessionProvider";
import { supplyExecutionKeys } from "../supply-execution/query-keys";
import { supportActionsKeys } from "../support-actions/query-keys";
import { buyerActionsKeys } from "../buyer-actions/query-keys";
import { workflowQueueKeys } from "../workflow/query-keys";
import {
  createIntegrationConnection,
  createIntegrationSyncRun,
  getIntegrationConnection,
  getIntegrationSyncRun,
  listIntegrationConnections,
  listIntegrationFailedRecords,
  listIntegrationSyncRuns,
  processIntegrationSyncRun,
  updateIntegrationConnection,
} from "./api";
import { integrationsKeys } from "./query-keys";
import type {
  CreateIntegrationConnectionInput,
  CreateIntegrationSyncRunInput,
  IntegrationConnectionFilters,
  UpdateIntegrationConnectionInput,
} from "./types";

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
    integrationsKeys.all,
    dataOpsKeys.all,
    supportActionsKeys.all,
    investigationKeys.all,
    outcomesDashboardKeys.all,
    decisionInboxKeys.all,
    workflowQueueKeys.all,
    supplyExecutionKeys.all,
    buyerActionsKeys.all,
  ] as const;

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
  );
};

export const useIntegrationConnections = (
  filters: Pick<IntegrationConnectionFilters, "integrationType" | "status">,
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: integrationsKeys.connections(session.userId, session.organizationId, filters),
    queryFn: () => listIntegrationConnections(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useIntegrationConnectionDetail = (integrationConnectionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      integrationConnectionId === null
        ? integrationsKeys.connectionDetail(session.userId, session.organizationId, "unselected")
        : integrationsKeys.connectionDetail(
            session.userId,
            session.organizationId,
            integrationConnectionId,
          ),
    queryFn: () => getIntegrationConnection(apiClient, integrationConnectionId as string),
    enabled: session.queryEnabled && integrationConnectionId !== null,
  });
};

export const useIntegrationSyncRuns = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: integrationsKeys.syncRuns(session.userId, session.organizationId),
    queryFn: () => listIntegrationSyncRuns(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useIntegrationSyncRunDetail = (syncRunId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      syncRunId === null
        ? integrationsKeys.syncRunDetail(session.userId, session.organizationId, "unselected")
        : integrationsKeys.syncRunDetail(session.userId, session.organizationId, syncRunId),
    queryFn: () => getIntegrationSyncRun(apiClient, syncRunId as string),
    enabled: session.queryEnabled && syncRunId !== null,
  });
};

export const useIntegrationFailedRecords = (
  filters: { resolved?: boolean } = { resolved: false },
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: integrationsKeys.failedRecords(session.userId, session.organizationId, filters),
    queryFn: () => listIntegrationFailedRecords(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useCreateIntegrationConnectionMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIntegrationConnectionInput) =>
      createIntegrationConnection(apiClient, input),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useUpdateIntegrationConnectionMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      integrationConnectionId: string;
      values: UpdateIntegrationConnectionInput;
    }) => updateIntegrationConnection(apiClient, input.integrationConnectionId, input.values),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useCreateIntegrationSyncRunMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIntegrationSyncRunInput) =>
      createIntegrationSyncRun(apiClient, input),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useProcessIntegrationSyncRunMutation = () => {
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
