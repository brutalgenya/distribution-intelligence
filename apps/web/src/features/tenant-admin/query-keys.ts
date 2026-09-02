export const tenantAdminKeys = {
  all: ["tenant-admin"] as const,
  memberships: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "memberships", userId, organizationId] as const,
  organizationEntitlements: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "organization-entitlements", userId, organizationId] as const,
  billingSubscription: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "billing-subscription", userId, organizationId] as const,
  billingEntitlements: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "billing-entitlements", userId, organizationId] as const,
  connections: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "connections", userId, organizationId] as const,
  syncRuns: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "sync-runs", userId, organizationId] as const,
  failedRecords: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "failed-records", userId, organizationId] as const,
  decisions: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "decisions", userId, organizationId] as const,
  approvals: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "approvals", userId, organizationId] as const,
  executions: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "executions", userId, organizationId] as const,
  auditTimeline: (userId: string, organizationId: string) =>
    [...tenantAdminKeys.all, "audit-timeline", userId, organizationId] as const,
};
