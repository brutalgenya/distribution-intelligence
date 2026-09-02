import type { DecisionFilters } from "./types";

export const decisionInboxKeys = {
  all: ["decision-inbox"] as const,
  list: (userId: string, organizationId: string, filters: DecisionFilters) =>
    [...decisionInboxKeys.all, "list", userId, organizationId, filters] as const,
  detail: (userId: string, organizationId: string, decisionId: string) =>
    [...decisionInboxKeys.all, "detail", userId, organizationId, decisionId] as const,
  approval: (userId: string, organizationId: string, decisionId: string) =>
    [...decisionInboxKeys.all, "approval", userId, organizationId, decisionId] as const,
  explanations: (userId: string, organizationId: string, decisionId: string) =>
    [...decisionInboxKeys.all, "explanations", userId, organizationId, decisionId] as const,
  outcomes: (userId: string, organizationId: string, decisionId: string) =>
    [...decisionInboxKeys.all, "outcomes", userId, organizationId, decisionId] as const,
};
