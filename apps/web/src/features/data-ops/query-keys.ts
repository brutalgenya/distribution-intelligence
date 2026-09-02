import type { DataOpsContextParams } from "./types";

export const dataOpsKeys = {
  all: ["data-ops"] as const,
  connections: (userId: string, organizationId: string) =>
    [...dataOpsKeys.all, "connections", userId, organizationId] as const,
  connectionDetail: (userId: string, organizationId: string, integrationConnectionId: string) =>
    [...dataOpsKeys.all, "connection-detail", userId, organizationId, integrationConnectionId] as const,
  syncRuns: (
    userId: string,
    organizationId: string,
    filters: { integrationConnectionId?: string | null },
  ) => [...dataOpsKeys.all, "sync-runs", userId, organizationId, filters] as const,
  syncRunDetail: (userId: string, organizationId: string, syncRunId: string) =>
    [...dataOpsKeys.all, "sync-run-detail", userId, organizationId, syncRunId] as const,
  failedRecords: (
    userId: string,
    organizationId: string,
    filters: { integrationConnectionId?: string | null; syncRunId?: string | null; resolved?: boolean },
  ) => [...dataOpsKeys.all, "failed-records", userId, organizationId, filters] as const,
  forecastJobs: (userId: string, organizationId: string) =>
    [...dataOpsKeys.all, "forecast-jobs", userId, organizationId] as const,
  forecastJobDetail: (userId: string, organizationId: string, forecastJobId: string) =>
    [...dataOpsKeys.all, "forecast-job-detail", userId, organizationId, forecastJobId] as const,
  forecastResults: (userId: string, organizationId: string, forecastJobId: string) =>
    [...dataOpsKeys.all, "forecast-results", userId, organizationId, forecastJobId] as const,
  salesImportRuns: (userId: string, organizationId: string) =>
    [...dataOpsKeys.all, "sales-import-runs", userId, organizationId] as const,
  customerOrders: (userId: string, organizationId: string, context: Pick<DataOpsContextParams, "skuId" | "locationId">) =>
    [...dataOpsKeys.all, "customer-orders", userId, organizationId, context] as const,
  aiRuns: (userId: string, organizationId: string) =>
    [...dataOpsKeys.all, "ai-runs", userId, organizationId] as const,
  anomalies: (userId: string, organizationId: string, context: Pick<DataOpsContextParams, "skuId" | "locationId">) =>
    [...dataOpsKeys.all, "anomalies", userId, organizationId, context] as const,
  workerStatus: (userId: string, organizationId: string) =>
    [...dataOpsKeys.all, "worker-status", userId, organizationId] as const,
};
