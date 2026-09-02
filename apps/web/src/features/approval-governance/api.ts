import type { ApiClient } from "../../lib/api/types";
import type { ApprovalTask, Decision, DecisionOutcome, Policy, PolicyEffectivenessSummary, SupportExecutionTask, SupportTimelineItem } from "./types";
import type { OperatorOverride } from "./types";

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

export const listApprovalTasks = (
  apiClient: ApiClient,
  filters: { status?: ApprovalTask["status"] } = {},
): Promise<ApprovalTask[]> =>
  apiClient.get(
    `/workflow/approvals${buildQueryString({
      status: filters.status,
    })}`,
  );

export const getApprovalTask = (
  apiClient: ApiClient,
  approvalTaskId: string,
): Promise<ApprovalTask> => apiClient.get(`/workflow/approvals/${approvalTaskId}`);

export const listGovernanceDecisions = (apiClient: ApiClient): Promise<Decision[]> =>
  apiClient.get("/decisioning/decisions");

export const getGovernanceDecision = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<Decision> => apiClient.get(`/decisioning/decisions/${decisionId}`);

export const listOperatorOverrides = (apiClient: ApiClient): Promise<OperatorOverride[]> =>
  apiClient.get("/workflow/overrides");

export const listFilteredOperatorOverrides = (
  apiClient: ApiClient,
  filters: {
    decisionId?: string;
    overrideType?: OperatorOverride["overrideType"];
  } = {},
): Promise<OperatorOverride[]> =>
  apiClient.get(
    `/workflow/overrides${buildQueryString({
      decisionId: filters.decisionId,
      overrideType: filters.overrideType,
    })}`,
  );

export const listGovernanceAuditTimeline = (
  apiClient: ApiClient,
  filters: { decisionId?: string | null } = {},
): Promise<SupportTimelineItem[]> =>
  apiClient.get(
    `/support/audit-timeline${buildQueryString({
      decisionId: filters.decisionId ?? undefined,
      limit: "50",
    })}`,
  );

export const listDecisionOutcomes = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<DecisionOutcome[]> => apiClient.get(`/outcomes/decisions/by-decision/${decisionId}`);

export const listGovernancePolicies = (apiClient: ApiClient): Promise<Policy[]> =>
  apiClient.get("/decisioning/policies");

export const listGovernancePolicySummaries = (
  apiClient: ApiClient,
): Promise<PolicyEffectivenessSummary[]> => apiClient.get("/outcomes/policies");

export const listGovernanceExecutions = (
  apiClient: ApiClient,
): Promise<SupportExecutionTask[]> => apiClient.get("/support/executions?limit=100");

export const approveApprovalTask = (
  apiClient: ApiClient,
  approvalTaskId: string,
  comment?: string,
): Promise<unknown> =>
  apiClient.post(`/workflow/approvals/${approvalTaskId}/approve`, comment ? { comment } : {});

export const rejectApprovalTask = (
  apiClient: ApiClient,
  approvalTaskId: string,
  comment?: string,
): Promise<unknown> =>
  apiClient.post(`/workflow/approvals/${approvalTaskId}/reject`, comment ? { comment } : {});
