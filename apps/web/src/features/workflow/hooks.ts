import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  cancelExecutionTask,
  getSupportExecution,
  listExecutionAttempts,
  listExecutionTimeline,
  listSupportExecutions,
  listWorkerStatus,
  retryExecutionTask,
} from "./api";
import { workflowQueueKeys } from "./query-keys";
import type { WorkflowQueueFilters } from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const invalidateWorkflowQueue = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: workflowQueueKeys.all });
  await queryClient.refetchQueries({ queryKey: workflowQueueKeys.all, type: "active" });
};

export const useExecutionQueue = (filters: WorkflowQueueFilters) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: workflowQueueKeys.list(session.userId, session.organizationId, filters),
    queryFn: () => listSupportExecutions(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useExecutionDetail = (executionTaskId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      executionTaskId === null
        ? workflowQueueKeys.detail(session.userId, session.organizationId, "unselected")
        : workflowQueueKeys.detail(session.userId, session.organizationId, executionTaskId),
    queryFn: () => getSupportExecution(apiClient, executionTaskId as string),
    enabled: session.queryEnabled && executionTaskId !== null,
  });
};

export const useExecutionAttempts = (executionTaskId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      executionTaskId === null
        ? workflowQueueKeys.attempts(session.userId, session.organizationId, "unselected")
        : workflowQueueKeys.attempts(session.userId, session.organizationId, executionTaskId),
    queryFn: () => listExecutionAttempts(apiClient, executionTaskId as string),
    enabled: session.queryEnabled && executionTaskId !== null,
  });
};

export const useExecutionTimeline = (executionTaskId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      executionTaskId === null
        ? workflowQueueKeys.timeline(session.userId, session.organizationId, "unselected")
        : workflowQueueKeys.timeline(session.userId, session.organizationId, executionTaskId),
    queryFn: () => listExecutionTimeline(apiClient, executionTaskId as string),
    enabled: session.queryEnabled && executionTaskId !== null,
  });
};

export const useWorkerStatus = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: workflowQueueKeys.workerStatus(session.userId, session.organizationId),
    queryFn: listWorkerStatus.bind(null, apiClient),
    enabled: session.queryEnabled,
    staleTime: 30_000,
  });
};

export const useRetryExecutionMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { executionTaskId: string; reason?: string }) =>
      retryExecutionTask(apiClient, input.executionTaskId, input.reason),
    onSuccess: async () => {
      await invalidateWorkflowQueue(queryClient);
    },
  });
};

export const useCancelExecutionMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { executionTaskId: string; reason?: string }) =>
      cancelExecutionTask(apiClient, input.executionTaskId, input.reason),
    onSuccess: async () => {
      await invalidateWorkflowQueue(queryClient);
    },
  });
};
