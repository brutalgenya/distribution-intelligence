import type { ApprovalGovernanceRouteParams } from "./types";

export const approvalGovernanceKeys = {
  all: ["approval-governance"] as const,
  approvals: (
    userId: string,
    organizationId: string,
    filters: { status?: string },
  ) => [...approvalGovernanceKeys.all, "approvals", userId, organizationId, filters] as const,
  approvalDetail: (userId: string, organizationId: string, approvalTaskId: string) =>
    [...approvalGovernanceKeys.all, "approval-detail", userId, organizationId, approvalTaskId] as const,
  decisions: (userId: string, organizationId: string) =>
    [...approvalGovernanceKeys.all, "decisions", userId, organizationId] as const,
  decisionDetail: (userId: string, organizationId: string, decisionId: string) =>
    [...approvalGovernanceKeys.all, "decision-detail", userId, organizationId, decisionId] as const,
  overrides: (userId: string, organizationId: string) =>
    [...approvalGovernanceKeys.all, "overrides", userId, organizationId] as const,
  filteredOverrides: (
    userId: string,
    organizationId: string,
    filters: { decisionId?: string; overrideType?: string },
  ) => [...approvalGovernanceKeys.all, "filtered-overrides", userId, organizationId, filters] as const,
  auditTimeline: (
    userId: string,
    organizationId: string,
    filters: { decisionId?: string | null },
  ) => [...approvalGovernanceKeys.all, "audit-timeline", userId, organizationId, filters] as const,
  decisionOutcomes: (userId: string, organizationId: string, decisionId: string) =>
    [...approvalGovernanceKeys.all, "decision-outcomes", userId, organizationId, decisionId] as const,
  policies: (userId: string, organizationId: string) =>
    [...approvalGovernanceKeys.all, "policies", userId, organizationId] as const,
  policySummaries: (userId: string, organizationId: string) =>
    [...approvalGovernanceKeys.all, "policy-summaries", userId, organizationId] as const,
  executions: (userId: string, organizationId: string) =>
    [...approvalGovernanceKeys.all, "executions", userId, organizationId] as const,
  context: (userId: string, organizationId: string, params: ApprovalGovernanceRouteParams) =>
    [...approvalGovernanceKeys.all, "context", userId, organizationId, params] as const,
};
