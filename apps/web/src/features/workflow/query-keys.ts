import type { WorkflowQueueFilters } from "./types";

export const workflowQueueKeys = {
  all: ["workflow-queue"] as const,
  list: (userId: string, organizationId: string, filters: WorkflowQueueFilters) =>
    [...workflowQueueKeys.all, "list", userId, organizationId, filters] as const,
  detail: (userId: string, organizationId: string, executionTaskId: string) =>
    [...workflowQueueKeys.all, "detail", userId, organizationId, executionTaskId] as const,
  attempts: (userId: string, organizationId: string, executionTaskId: string) =>
    [...workflowQueueKeys.all, "attempts", userId, organizationId, executionTaskId] as const,
  timeline: (userId: string, organizationId: string, executionTaskId: string) =>
    [...workflowQueueKeys.all, "timeline", userId, organizationId, executionTaskId] as const,
  workerStatus: (userId: string, organizationId: string) =>
    [...workflowQueueKeys.all, "worker-status", userId, organizationId] as const,
};
