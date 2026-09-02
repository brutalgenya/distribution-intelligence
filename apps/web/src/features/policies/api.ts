import type { ApiClient } from "../../lib/api/types";
import type {
  ApprovalTask,
  CreatePolicyInput,
  Decision,
  Policy,
  PolicyEffectivenessSummary,
  PolicyFilters,
  SupportTimelineItem,
  UpdatePolicyInput,
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

export const listPolicies = (
  apiClient: ApiClient,
  filters: PolicyFilters,
): Promise<Policy[]> =>
  apiClient.get(
    `/decisioning/policies${buildQueryString({
      policyType: filters.policyType,
      status: filters.status,
    })}`,
  );

export const getPolicy = (
  apiClient: ApiClient,
  policyId: string,
): Promise<Policy> => apiClient.get(`/decisioning/policies/${policyId}`);

export const createPolicy = (
  apiClient: ApiClient,
  input: CreatePolicyInput,
): Promise<Policy> => apiClient.post("/decisioning/policies", input);

export const updatePolicy = (
  apiClient: ApiClient,
  policyId: string,
  input: UpdatePolicyInput,
): Promise<Policy> => apiClient.patch(`/decisioning/policies/${policyId}`, input);

export const activatePolicy = (
  apiClient: ApiClient,
  policyId: string,
): Promise<Policy> => apiClient.post(`/decisioning/policies/${policyId}/activate`, {});

export const listPolicyEffectivenessSummaries = (
  apiClient: ApiClient,
): Promise<PolicyEffectivenessSummary[]> => apiClient.get("/outcomes/policies");

export const listPolicyEffectivenessByPolicy = (
  apiClient: ApiClient,
  policyId: string,
): Promise<PolicyEffectivenessSummary[]> => apiClient.get(`/outcomes/policies/by-policy/${policyId}`);

export const listGovernanceDecisions = (
  apiClient: ApiClient,
): Promise<Decision[]> => apiClient.get("/decisioning/decisions");

export const listGovernanceApprovals = (
  apiClient: ApiClient,
): Promise<ApprovalTask[]> => apiClient.get("/workflow/approvals");

export const listGovernanceAuditTimeline = (
  apiClient: ApiClient,
): Promise<SupportTimelineItem[]> => apiClient.get("/support/audit-timeline?limit=50");
