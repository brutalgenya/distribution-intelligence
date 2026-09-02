import type { InvestigationParams } from "./types";

export const investigationKeys = {
  all: ["investigation-workspace"] as const,
  context: (userId: string, organizationId: string, params: InvestigationParams) =>
    [...investigationKeys.all, "context", userId, organizationId, params] as const,
  signals: (userId: string, organizationId: string, params: InvestigationParams) =>
    [...investigationKeys.all, "signals", userId, organizationId, params] as const,
  forecastDemand: (userId: string, organizationId: string, params: InvestigationParams) =>
    [...investigationKeys.all, "forecast-demand", userId, organizationId, params] as const,
  supply: (userId: string, organizationId: string, params: InvestigationParams) =>
    [...investigationKeys.all, "supply", userId, organizationId, params] as const,
  decisions: (userId: string, organizationId: string, params: InvestigationParams) =>
    [...investigationKeys.all, "decisions", userId, organizationId, params] as const,
};
