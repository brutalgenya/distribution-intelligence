import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { decisionInboxKeys } from "../decisions/query-keys";
import { outcomesDashboardKeys } from "../outcomes/query-keys";
import { policiesKeys } from "../policies/query-keys";
import { useSession } from "../session/SessionProvider";
import { workflowQueueKeys } from "../workflow/query-keys";
import {
  approveApprovalTask,
  getApprovalTask,
  getGovernanceDecision,
  listApprovalTasks,
  listDecisionOutcomes,
  listFilteredOperatorOverrides,
  listGovernanceAuditTimeline,
  listGovernanceDecisions,
  listGovernanceExecutions,
  listGovernancePolicies,
  listGovernancePolicySummaries,
  rejectApprovalTask,
} from "./api";
import { approvalGovernanceKeys } from "./query-keys";
import type { ApprovalTask, OperatorOverrideType } from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const invalidateGovernanceQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  const queryKeys = [
    approvalGovernanceKeys.all,
    decisionInboxKeys.all,
    workflowQueueKeys.all,
    policiesKeys.all,
    outcomesDashboardKeys.all,
  ] as const;

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
  );
};

export const useApprovalTasks = (filters: { status?: ApprovalTask["status"] } = {}) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.approvals(session.userId, session.organizationId, filters),
    queryFn: () => listApprovalTasks(apiClient, { status: filters.status }),
    enabled: session.queryEnabled,
  });
};

export const useApprovalTaskDetail = (approvalTaskId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      approvalTaskId === null
        ? approvalGovernanceKeys.approvalDetail(session.userId, session.organizationId, "unselected")
        : approvalGovernanceKeys.approvalDetail(session.userId, session.organizationId, approvalTaskId),
    queryFn: () => getApprovalTask(apiClient, approvalTaskId as string),
    enabled: session.queryEnabled && approvalTaskId !== null,
  });
};

export const useApprovalGovernanceDecisions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.decisions(session.userId, session.organizationId),
    queryFn: () => listGovernanceDecisions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useApprovalGovernanceDecisionDetail = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      decisionId === null
        ? approvalGovernanceKeys.decisionDetail(session.userId, session.organizationId, "unselected")
        : approvalGovernanceKeys.decisionDetail(session.userId, session.organizationId, decisionId),
    queryFn: () => getGovernanceDecision(apiClient, decisionId as string),
    enabled: session.queryEnabled && decisionId !== null,
  });
};

export const useOperatorOverrides = (
  filters: {
    decisionId?: string;
    overrideType?: OperatorOverrideType;
  } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.filteredOverrides(
      session.userId,
      session.organizationId,
      filters,
    ),
    queryFn: () => listFilteredOperatorOverrides(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useApprovalGovernanceTimeline = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.auditTimeline(session.userId, session.organizationId, {
      decisionId,
    }),
    queryFn: () => listGovernanceAuditTimeline(apiClient, { decisionId }),
    enabled: session.queryEnabled,
  });
};

export const useApprovalGovernanceDecisionOutcomes = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      decisionId === null
        ? approvalGovernanceKeys.decisionOutcomes(session.userId, session.organizationId, "unselected")
        : approvalGovernanceKeys.decisionOutcomes(session.userId, session.organizationId, decisionId),
    queryFn: () => listDecisionOutcomes(apiClient, decisionId as string),
    enabled: session.queryEnabled && decisionId !== null,
  });
};

export const useApprovalGovernancePolicies = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.policies(session.userId, session.organizationId),
    queryFn: () => listGovernancePolicies(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useApprovalGovernancePolicySummaries = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.policySummaries(session.userId, session.organizationId),
    queryFn: () => listGovernancePolicySummaries(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useApprovalGovernanceExecutions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: approvalGovernanceKeys.executions(session.userId, session.organizationId),
    queryFn: () => listGovernanceExecutions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useApproveGovernanceApprovalMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { approvalTaskId: string; comment?: string }) =>
      approveApprovalTask(apiClient, input.approvalTaskId, input.comment),
    onSuccess: async () => {
      await invalidateGovernanceQueries(queryClient);
    },
  });
};

export const useRejectGovernanceApprovalMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { approvalTaskId: string; comment?: string }) =>
      rejectApprovalTask(apiClient, input.approvalTaskId, input.comment),
    onSuccess: async () => {
      await invalidateGovernanceQueries(queryClient);
    },
  });
};
