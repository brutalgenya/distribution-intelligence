import type { IntegrationConnectionFilters, IntegrationsRouteParams } from "./types";

export const integrationsKeys = {
  all: ["integrations"] as const,
  connections: (
    userId: string,
    organizationId: string,
    filters: Pick<IntegrationConnectionFilters, "integrationType" | "status">,
  ) => [...integrationsKeys.all, "connections", userId, organizationId, filters] as const,
  connectionDetail: (userId: string, organizationId: string, integrationConnectionId: string) =>
    [...integrationsKeys.all, "connection-detail", userId, organizationId, integrationConnectionId] as const,
  syncRuns: (userId: string, organizationId: string) =>
    [...integrationsKeys.all, "sync-runs", userId, organizationId] as const,
  syncRunDetail: (userId: string, organizationId: string, syncRunId: string) =>
    [...integrationsKeys.all, "sync-run-detail", userId, organizationId, syncRunId] as const,
  failedRecords: (
    userId: string,
    organizationId: string,
    filters: { resolved?: boolean },
  ) => [...integrationsKeys.all, "failed-records", userId, organizationId, filters] as const,
  context: (userId: string, organizationId: string, params: IntegrationsRouteParams) =>
    [...integrationsKeys.all, "context", userId, organizationId, params] as const,
};
