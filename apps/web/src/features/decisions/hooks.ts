import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  approveApprovalTask,
  getDecision,
  listDecisionExplanations,
  listDecisions,
  listDecisionOutcomes,
  listPendingApprovalTasks,
  rejectApprovalTask,
  requestDecisionApproval,
} from "./api";
import { decisionInboxKeys } from "./query-keys";
import type { DecisionFilters } from "./types";

const useConfiguredSession = () => {
  const session = useSession();
  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const invalidateInbox = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: decisionInboxKeys.all });
};

export const useDecisions = (filters: DecisionFilters) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: decisionInboxKeys.list(session.userId, session.organizationId, filters),
    queryFn: () => listDecisions(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useDecisionDetail = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      decisionId === null
        ? decisionInboxKeys.detail(session.userId, session.organizationId, "unselected")
        : decisionInboxKeys.detail(session.userId, session.organizationId, decisionId),
    queryFn: () => getDecision(apiClient, decisionId as string),
    enabled: session.queryEnabled && decisionId !== null,
  });
};

export const usePendingApprovalTask = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      decisionId === null
        ? decisionInboxKeys.approval(session.userId, session.organizationId, "unselected")
        : decisionInboxKeys.approval(session.userId, session.organizationId, decisionId),
    queryFn: async () => {
      const tasks = await listPendingApprovalTasks(apiClient, decisionId as string);
      return tasks[0] ?? null;
    },
    enabled: session.queryEnabled && decisionId !== null,
  });
};

export const useLatestDecisionExplanation = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      decisionId === null
        ? decisionInboxKeys.explanations(session.userId, session.organizationId, "unselected")
        : decisionInboxKeys.explanations(session.userId, session.organizationId, decisionId),
    queryFn: async () => {
      const explanations = await listDecisionExplanations(apiClient, decisionId as string);
      return explanations[0] ?? null;
    },
    enabled: session.queryEnabled && decisionId !== null,
  });
};

export const useLatestDecisionOutcome = (decisionId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      decisionId === null
        ? decisionInboxKeys.outcomes(session.userId, session.organizationId, "unselected")
        : decisionInboxKeys.outcomes(session.userId, session.organizationId, decisionId),
    queryFn: async () => {
      const outcomes = await listDecisionOutcomes(apiClient, decisionId as string);
      return outcomes[0] ?? null;
    },
    enabled: session.queryEnabled && decisionId !== null,
  });
};

export const useRequestApprovalMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (decisionId: string) => requestDecisionApproval(apiClient, decisionId),
    onSuccess: async () => {
      await invalidateInbox(queryClient);
    },
  });
};

export const useApproveApprovalMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalTaskId: string) => approveApprovalTask(apiClient, approvalTaskId),
    onSuccess: async () => {
      await invalidateInbox(queryClient);
    },
  });
};

export const useRejectApprovalMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalTaskId: string) => rejectApprovalTask(apiClient, approvalTaskId),
    onSuccess: async () => {
      await invalidateInbox(queryClient);
    },
  });
};
