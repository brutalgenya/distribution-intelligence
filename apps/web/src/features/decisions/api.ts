import type { ApiClient } from "../../lib/api/types";
import type {
  ApprovalTask,
  Decision,
  DecisionExplanation,
  DecisionFilters,
  DecisionOutcome,
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

export const listDecisions = (apiClient: ApiClient, filters: DecisionFilters): Promise<Decision[]> =>
  apiClient.get(
    `/decisioning/decisions${buildQueryString({
      decisionType: filters.decisionType,
      status: filters.status,
    })}`,
  );

export const getDecision = (apiClient: ApiClient, decisionId: string): Promise<Decision> =>
  apiClient.get(`/decisioning/decisions/${decisionId}`);

export const listPendingApprovalTasks = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<ApprovalTask[]> =>
  apiClient.get(
    `/workflow/approvals${buildQueryString({
      decisionId,
      status: "pending",
    })}`,
  );

export const requestDecisionApproval = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<unknown> => apiClient.post(`/workflow/decisions/${decisionId}/request-approval`, {});

export const approveApprovalTask = (
  apiClient: ApiClient,
  approvalTaskId: string,
): Promise<unknown> => apiClient.post(`/workflow/approvals/${approvalTaskId}/approve`, {});

export const rejectApprovalTask = (
  apiClient: ApiClient,
  approvalTaskId: string,
): Promise<unknown> => apiClient.post(`/workflow/approvals/${approvalTaskId}/reject`, {});

export const listDecisionExplanations = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<DecisionExplanation[]> =>
  apiClient.get(`/ai/decisions/explanations${buildQueryString({ decisionId })}`);

export const listDecisionOutcomes = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<DecisionOutcome[]> => apiClient.get(`/outcomes/decisions/by-decision/${decisionId}`);
