import type { SupportActionsRouteParams } from "./types";

export const supportActionsKeys = {
  all: ["support-actions"] as const,
  executions: (
    userId: string,
    organizationId: string,
    filters: { status?: string; decisionId?: string; from?: string; to?: string; limit?: number },
  ) => [...supportActionsKeys.all, "executions", userId, organizationId, filters] as const,
  executionDetail: (userId: string, organizationId: string, executionTaskId: string) =>
    [...supportActionsKeys.all, "execution-detail", userId, organizationId, executionTaskId] as const,
  executionAttempts: (userId: string, organizationId: string, executionTaskId: string) =>
    [...supportActionsKeys.all, "execution-attempts", userId, organizationId, executionTaskId] as const,
  forecastJobs: (
    userId: string,
    organizationId: string,
    filters: { status?: string; from?: string; to?: string; limit?: number },
  ) => [...supportActionsKeys.all, "forecast-jobs", userId, organizationId, filters] as const,
  forecastJobDetail: (userId: string, organizationId: string, forecastJobId: string) =>
    [...supportActionsKeys.all, "forecast-job-detail", userId, organizationId, forecastJobId] as const,
  forecastResults: (userId: string, organizationId: string, forecastJobId: string) =>
    [...supportActionsKeys.all, "forecast-results", userId, organizationId, forecastJobId] as const,
  connections: (userId: string, organizationId: string) =>
    [...supportActionsKeys.all, "connections", userId, organizationId] as const,
  syncRuns: (
    userId: string,
    organizationId: string,
    filters: { integrationConnectionId?: string | null; status?: string },
  ) => [...supportActionsKeys.all, "sync-runs", userId, organizationId, filters] as const,
  syncRunDetail: (userId: string, organizationId: string, syncRunId: string) =>
    [...supportActionsKeys.all, "sync-run-detail", userId, organizationId, syncRunId] as const,
  failedRecords: (
    userId: string,
    organizationId: string,
    filters: { integrationConnectionId?: string | null; syncRunId?: string | null; resolved?: boolean },
  ) => [...supportActionsKeys.all, "failed-records", userId, organizationId, filters] as const,
  workerStatus: (userId: string, organizationId: string) =>
    [...supportActionsKeys.all, "worker-status", userId, organizationId] as const,
  context: (userId: string, organizationId: string, params: SupportActionsRouteParams) =>
    [...supportActionsKeys.all, "context", userId, organizationId, params] as const,
};
