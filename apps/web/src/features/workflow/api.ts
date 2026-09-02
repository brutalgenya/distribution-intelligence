import type { ApiClient } from "../../lib/api/types";
import type {
  SupportExecutionAttempt,
  SupportExecutionTask,
  SupportTimelineItem,
  WorkerStatus,
  WorkflowQueueFilters,
} from "./types";

const buildQueryString = (filters: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
};

const toIsoBoundary = (value: string | undefined, boundary: "start" | "end"): string | undefined => {
  if (!value) {
    return undefined;
  }

  return boundary === "start"
    ? new Date(`${value}T00:00:00.000Z`).toISOString()
    : new Date(`${value}T23:59:59.999Z`).toISOString();
};

export const listSupportExecutions = (
  apiClient: ApiClient,
  filters: WorkflowQueueFilters,
): Promise<SupportExecutionTask[]> =>
  apiClient.get(
    `/support/executions${buildQueryString({
      status: filters.status,
      from: toIsoBoundary(filters.from, "start"),
      to: toIsoBoundary(filters.to, "end"),
      limit: "100",
    })}`,
  );

export const getSupportExecution = (
  apiClient: ApiClient,
  executionTaskId: string,
): Promise<SupportExecutionTask> => apiClient.get(`/support/executions/${executionTaskId}`);

export const listExecutionAttempts = (
  apiClient: ApiClient,
  executionTaskId: string,
): Promise<SupportExecutionAttempt[]> => apiClient.get(`/support/executions/${executionTaskId}/attempts`);

export const listExecutionTimeline = (
  apiClient: ApiClient,
  executionTaskId: string,
): Promise<SupportTimelineItem[]> =>
  apiClient.get(
    `/support/audit-timeline${buildQueryString({
      executionTaskId,
      limit: "20",
    })}`,
  );

export const listWorkerStatus = (apiClient: ApiClient): Promise<WorkerStatus[]> =>
  apiClient.get("/support/worker-status");

export const retryExecutionTask = (
  apiClient: ApiClient,
  executionTaskId: string,
  reason?: string,
): Promise<unknown> => apiClient.post(`/workflow/executions/${executionTaskId}/retry`, reason ? { reason } : {});

export const cancelExecutionTask = (
  apiClient: ApiClient,
  executionTaskId: string,
  reason?: string,
): Promise<unknown> => apiClient.post(`/workflow/executions/${executionTaskId}/cancel`, reason ? { reason } : {});
