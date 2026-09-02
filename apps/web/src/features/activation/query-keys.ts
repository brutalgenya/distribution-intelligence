export const activationKeys = {
  all: ["activation"] as const,
  plans: (userId: string, organizationId: string) =>
    [...activationKeys.all, "plans", userId, organizationId] as const,
  subscription: (userId: string, organizationId: string) =>
    [...activationKeys.all, "subscription", userId, organizationId] as const,
  entitlements: (userId: string, organizationId: string) =>
    [...activationKeys.all, "entitlements", userId, organizationId] as const,
  usage: (userId: string, organizationId: string) =>
    [...activationKeys.all, "usage", userId, organizationId] as const,
  connections: (userId: string, organizationId: string) =>
    [...activationKeys.all, "connections", userId, organizationId] as const,
  syncRuns: (userId: string, organizationId: string) =>
    [...activationKeys.all, "sync-runs", userId, organizationId] as const,
  failedRecords: (userId: string, organizationId: string) =>
    [...activationKeys.all, "failed-records", userId, organizationId] as const,
  forecastJobs: (userId: string, organizationId: string) =>
    [...activationKeys.all, "forecast-jobs", userId, organizationId] as const,
  forecastResults: (userId: string, organizationId: string, forecastJobId: string) =>
    [...activationKeys.all, "forecast-results", userId, organizationId, forecastJobId] as const,
  decisions: (userId: string, organizationId: string) =>
    [...activationKeys.all, "decisions", userId, organizationId] as const,
  approvals: (userId: string, organizationId: string) =>
    [...activationKeys.all, "approvals", userId, organizationId] as const,
  executions: (userId: string, organizationId: string) =>
    [...activationKeys.all, "executions", userId, organizationId] as const,
};
