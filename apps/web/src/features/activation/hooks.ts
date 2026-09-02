import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { dataOpsKeys } from "../data-ops/query-keys";
import { decisionInboxKeys } from "../decisions/query-keys";
import { integrationsKeys } from "../integrations/query-keys";
import { outcomesDashboardKeys } from "../outcomes/query-keys";
import { useSession } from "../session/SessionProvider";
import { supportActionsKeys } from "../support-actions/query-keys";
import { workflowQueueKeys } from "../workflow/query-keys";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingEntitlements,
  getCurrentSubscription,
  listApprovalTasks,
  listBillingPlans,
  listBillingUsageMeters,
  listDecisions,
  listExecutions,
  listForecastJobs,
  listForecastResults,
  listIntegrationConnections,
  listIntegrationFailedRecords,
  listIntegrationSyncRuns,
  processIntegrationSyncRun,
} from "./api";
import { activationKeys } from "./query-keys";

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
    activationKeys.all,
    integrationsKeys.all,
    dataOpsKeys.all,
    supportActionsKeys.all,
    decisionInboxKeys.all,
    workflowQueueKeys.all,
    outcomesDashboardKeys.all,
  ] as const;

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
  );
};

export const useBillingPlans = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.plans(session.userId, session.organizationId),
    queryFn: () => listBillingPlans(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useCurrentSubscription = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.subscription(session.userId, session.organizationId),
    queryFn: () => getCurrentSubscription(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useBillingEntitlements = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.entitlements(session.userId, session.organizationId),
    queryFn: () => getBillingEntitlements(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useBillingUsageMeters = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.usage(session.userId, session.organizationId),
    queryFn: () => listBillingUsageMeters(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationConnections = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.connections(session.userId, session.organizationId),
    queryFn: () => listIntegrationConnections(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationSyncRuns = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.syncRuns(session.userId, session.organizationId),
    queryFn: () => listIntegrationSyncRuns(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationFailedRecords = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.failedRecords(session.userId, session.organizationId),
    queryFn: () => listIntegrationFailedRecords(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationForecastJobs = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.forecastJobs(session.userId, session.organizationId),
    queryFn: () => listForecastJobs(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationForecastResults = (forecastJobId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      forecastJobId === null
        ? activationKeys.forecastResults(session.userId, session.organizationId, "unselected")
        : activationKeys.forecastResults(session.userId, session.organizationId, forecastJobId),
    queryFn: () => listForecastResults(apiClient, forecastJobId as string),
    enabled: session.queryEnabled && forecastJobId !== null,
  });
};

export const useActivationDecisions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.decisions(session.userId, session.organizationId),
    queryFn: () => listDecisions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationApprovals = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.approvals(session.userId, session.organizationId),
    queryFn: () => listApprovalTasks(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useActivationExecutions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: activationKeys.executions(session.userId, session.organizationId),
    queryFn: () => listExecutions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useCreateCheckoutSessionMutation = () => {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: (input: { planCode: string; successUrl?: string; cancelUrl?: string }) =>
      createCheckoutSession(apiClient, input),
  });
};

export const useCreatePortalSessionMutation = () => {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: (input: { returnUrl?: string }) => createPortalSession(apiClient, input),
  });
};

export const useProcessActivationSyncMutation = () => {
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
