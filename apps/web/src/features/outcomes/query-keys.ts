export const outcomesDashboardKeys = {
  all: ["outcomes-dashboard"] as const,
  skus: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "skus", userId, organizationId] as const,
  locations: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "locations", userId, organizationId] as const,
  inventoryPositions: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "inventory-positions", userId, organizationId] as const,
  stockouts: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "stockouts", userId, organizationId] as const,
  anomalies: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "anomalies", userId, organizationId] as const,
  fillRate: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "fill-rate", userId, organizationId] as const,
  forecastError: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "forecast-error", userId, organizationId] as const,
  decisionOutcomes: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "decision-outcomes", userId, organizationId] as const,
  policySummaries: (userId: string, organizationId: string) =>
    [...outcomesDashboardKeys.all, "policy-summaries", userId, organizationId] as const,
};
