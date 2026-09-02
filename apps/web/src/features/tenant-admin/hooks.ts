import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  getBillingEntitlements,
  getCurrentSubscription,
  inviteOrganizationMember,
  listApprovalTasks,
  listAuditTimeline,
  listDecisions,
  listExecutions,
  listIntegrationConnections,
  listIntegrationFailedRecords,
  listIntegrationSyncRuns,
  listOrganizationEntitlements,
  listOrganizationMemberships,
} from "./api";
import { tenantAdminKeys } from "./query-keys";
import type { InviteMemberInput } from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const invalidateTenantAdminQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: tenantAdminKeys.all });
  await queryClient.refetchQueries({ queryKey: tenantAdminKeys.all, type: "active" });
};

export const useTenantMemberships = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.memberships(session.userId, session.organizationId),
    queryFn: () => listOrganizationMemberships(apiClient, session.organizationId),
    enabled: session.queryEnabled,
  });
};

export const useTenantOrganizationEntitlements = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.organizationEntitlements(session.userId, session.organizationId),
    queryFn: () => listOrganizationEntitlements(apiClient, session.organizationId),
    enabled: session.queryEnabled,
  });
};

export const useTenantBillingSubscription = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.billingSubscription(session.userId, session.organizationId),
    queryFn: () => getCurrentSubscription(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantBillingEntitlements = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.billingEntitlements(session.userId, session.organizationId),
    queryFn: () => getBillingEntitlements(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantIntegrationConnections = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.connections(session.userId, session.organizationId),
    queryFn: () => listIntegrationConnections(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantIntegrationSyncRuns = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.syncRuns(session.userId, session.organizationId),
    queryFn: () => listIntegrationSyncRuns(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantFailedRecords = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.failedRecords(session.userId, session.organizationId),
    queryFn: () => listIntegrationFailedRecords(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantDecisions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.decisions(session.userId, session.organizationId),
    queryFn: () => listDecisions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantApprovals = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.approvals(session.userId, session.organizationId),
    queryFn: () => listApprovalTasks(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantExecutions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.executions(session.userId, session.organizationId),
    queryFn: () => listExecutions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useTenantAuditTimeline = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: tenantAdminKeys.auditTimeline(session.userId, session.organizationId),
    queryFn: () => listAuditTimeline(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useInviteOrganizationMemberMutation = () => {
  const apiClient = useApiClient();
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InviteMemberInput) =>
      inviteOrganizationMember(apiClient, session.organizationId, input),
    onSuccess: async () => {
      await invalidateTenantAdminQueries(queryClient);
    },
  });
};
