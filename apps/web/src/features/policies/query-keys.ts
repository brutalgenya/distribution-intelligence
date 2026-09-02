import type { PoliciesRouteParams, PolicyFilters } from "./types";

export const policiesKeys = {
  all: ["policy-governance"] as const,
  list: (userId: string, organizationId: string, filters: PolicyFilters) =>
    [...policiesKeys.all, "list", userId, organizationId, filters] as const,
  detail: (userId: string, organizationId: string, policyId: string) =>
    [...policiesKeys.all, "detail", userId, organizationId, policyId] as const,
  effectiveness: (userId: string, organizationId: string) =>
    [...policiesKeys.all, "effectiveness", userId, organizationId] as const,
  policyEffectiveness: (userId: string, organizationId: string, policyId: string) =>
    [...policiesKeys.all, "policy-effectiveness", userId, organizationId, policyId] as const,
  decisions: (userId: string, organizationId: string) =>
    [...policiesKeys.all, "decisions", userId, organizationId] as const,
  approvals: (userId: string, organizationId: string) =>
    [...policiesKeys.all, "approvals", userId, organizationId] as const,
  auditTimeline: (userId: string, organizationId: string) =>
    [...policiesKeys.all, "audit-timeline", userId, organizationId] as const,
  context: (userId: string, organizationId: string, params: PoliciesRouteParams) =>
    [...policiesKeys.all, "context", userId, organizationId, params] as const,
};
