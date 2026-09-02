import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { decisionInboxKeys } from "../decisions/query-keys";
import { outcomesDashboardKeys } from "../outcomes/query-keys";
import { useSession } from "../session/SessionProvider";
import { workflowQueueKeys } from "../workflow/query-keys";
import {
  activatePolicy,
  createPolicy,
  getPolicy,
  listGovernanceApprovals,
  listGovernanceAuditTimeline,
  listGovernanceDecisions,
  listPolicies,
  listPolicyEffectivenessByPolicy,
  listPolicyEffectivenessSummaries,
  updatePolicy,
} from "./api";
import { policiesKeys } from "./query-keys";
import type { CreatePolicyInput, PolicyFilters, UpdatePolicyInput } from "./types";

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
    policiesKeys.all,
    decisionInboxKeys.all,
    outcomesDashboardKeys.all,
    workflowQueueKeys.all,
  ] as const;

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
  );
};

export const usePolicies = (filters: PolicyFilters) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: policiesKeys.list(session.userId, session.organizationId, filters),
    queryFn: () => listPolicies(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const usePolicyDetail = (policyId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      policyId === null
        ? policiesKeys.detail(session.userId, session.organizationId, "unselected")
        : policiesKeys.detail(session.userId, session.organizationId, policyId),
    queryFn: () => getPolicy(apiClient, policyId as string),
    enabled: session.queryEnabled && policyId !== null,
  });
};

export const usePolicyEffectivenessSummaries = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: policiesKeys.effectiveness(session.userId, session.organizationId),
    queryFn: () => listPolicyEffectivenessSummaries(apiClient),
    enabled: session.queryEnabled,
  });
};

export const usePolicyEffectivenessDetail = (policyId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      policyId === null
        ? policiesKeys.policyEffectiveness(session.userId, session.organizationId, "unselected")
        : policiesKeys.policyEffectiveness(session.userId, session.organizationId, policyId),
    queryFn: () => listPolicyEffectivenessByPolicy(apiClient, policyId as string),
    enabled: session.queryEnabled && policyId !== null,
  });
};

export const useGovernanceDecisions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: policiesKeys.decisions(session.userId, session.organizationId),
    queryFn: () => listGovernanceDecisions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useGovernanceApprovals = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: policiesKeys.approvals(session.userId, session.organizationId),
    queryFn: () => listGovernanceApprovals(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useGovernanceAuditTimeline = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: policiesKeys.auditTimeline(session.userId, session.organizationId),
    queryFn: () => listGovernanceAuditTimeline(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useCreatePolicyMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePolicyInput) => createPolicy(apiClient, input),
    onSuccess: async () => {
      await invalidateGovernanceQueries(queryClient);
    },
  });
};

export const useUpdatePolicyMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { policyId: string; values: UpdatePolicyInput }) =>
      updatePolicy(apiClient, input.policyId, input.values),
    onSuccess: async () => {
      await invalidateGovernanceQueries(queryClient);
    },
  });
};

export const useActivatePolicyMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { policyId: string }) => activatePolicy(apiClient, input.policyId),
    onSuccess: async () => {
      await invalidateGovernanceQueries(queryClient);
    },
  });
};
