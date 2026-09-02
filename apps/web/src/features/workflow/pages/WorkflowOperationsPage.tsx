import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { MetricCard } from "../../../components/ui/MetricCard";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SectionCard } from "../../../components/ui/SectionCard";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { ExecutionDetailDrawer } from "../components/ExecutionDetailDrawer";
import { ExecutionQueueFilters } from "../components/ExecutionQueueFilters";
import { ExecutionQueueTable } from "../components/ExecutionQueueTable";
import { ExecutionWorkerStatusCard } from "../components/ExecutionWorkerStatusCard";
import { useExecutionQueue, useWorkerStatus } from "../hooks";
import type { ExecutionTaskStatus, ExecutionTaskType } from "../types";

const isExecutionStatus = (value: string | null): value is ExecutionTaskStatus =>
  value === "pending" ||
  value === "running" ||
  value === "succeeded" ||
  value === "failed" ||
  value === "dead_lettered" ||
  value === "cancelled";

const isExecutionTaskType = (value: string | null): value is ExecutionTaskType =>
  value === "create_purchase_order" ||
  value === "create_transfer_order" ||
  value === "notify_operator";

export const WorkflowOperationsPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const taskTypeParam = searchParams.get("taskType");

  const status = isExecutionStatus(statusParam) ? statusParam : "all";
  const taskType = isExecutionTaskType(taskTypeParam) ? taskTypeParam : "all";
  const search = searchParams.get("q") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const selectedExecutionTaskId = searchParams.get("executionId");

  const queueFilters = useMemo(
    () => ({
      ...(status !== "all" ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [from, status, to],
  );

  const executionQueueQuery = useExecutionQueue(queueFilters);
  const workerStatusQuery = useWorkerStatus();
  const executionWorkerStatus =
    workerStatusQuery.data?.find((workerStatus) => workerStatus.workerType === "execution") ?? null;

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (executionQueueQuery.data ?? []).filter((task) => {
      if (taskType !== "all" && task.taskType !== taskType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        task.id.toLowerCase().includes(normalizedSearch) ||
        task.decisionId.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [executionQueueQuery.data, search, taskType]);

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  };

  const handleStatusChange = (value: ExecutionTaskStatus | "all") => {
    updateParams((params) => {
      if (value === "all") {
        params.delete("status");
      } else {
        params.set("status", value);
      }
    });
  };

  const handleTaskTypeChange = (value: ExecutionTaskType | "all") => {
    updateParams((params) => {
      if (value === "all") {
        params.delete("taskType");
      } else {
        params.set("taskType", value);
      }
    });
  };

  const handleSearchChange = (value: string) => {
    updateParams((params) => {
      if (value.trim().length === 0) {
        params.delete("q");
      } else {
        params.set("q", value);
      }
    });
  };

  const handleFromChange = (value: string) => {
    updateParams((params) => {
      if (!value) {
        params.delete("from");
      } else {
        params.set("from", value);
      }
    });
  };

  const handleToChange = (value: string) => {
    updateParams((params) => {
      if (!value) {
        params.delete("to");
      } else {
        params.set("to", value);
      }
    });
  };

  const handleSelectExecution = (executionTaskId: string) => {
    updateParams((params) => {
      params.set("executionId", executionTaskId);
    });
  };

  const handleCloseDrawer = () => {
    updateParams((params) => {
      params.delete("executionId");
    });
  };

  const handleReset = () => {
    updateParams((params) => {
      params.delete("status");
      params.delete("taskType");
      params.delete("q");
      params.delete("from");
      params.delete("to");
    });
  };

  const queueErrorMessage =
    executionQueueQuery.error && isApiError(executionQueueQuery.error)
      ? `${executionQueueQuery.error.message} Correlation: ${executionQueueQuery.error.correlationId}.`
      : "The execution queue could not be loaded.";

  const failedTasks = filteredTasks.filter(
    (task) => task.status === "failed" || task.status === "dead_lettered",
  );
  const runningCount = filteredTasks.filter((task) => task.status === "running").length;
  const pendingCount = filteredTasks.filter((task) => task.status === "pending").length;

  return (
    <>
      <div className="page-stack">
        <PageIntro
          eyebrow="Workflow Operations"
          title="Execution queue"
          description="Operational oversight of automated fulfillment, execution retries, and queue pressure across the real workflow endpoints."
          actions={<StatusChip tone="info">{filteredTasks.length} filtered</StatusChip>}
        />

        {!session.isConfigured ? (
          <EmptyState
            title="Set demo session headers"
            message="Paste the seeded demo user id and organization id into the session panel above. The app sends those values as x-user-id and x-organization-id on every request."
          />
        ) : (
          <SplitPanel
            primary={
              <div className="space-y-4">
                <ExecutionQueueFilters
                  status={status}
                  taskType={taskType}
                  search={search}
                  from={from}
                  to={to}
                  count={filteredTasks.length}
                  onStatusChange={handleStatusChange}
                  onTaskTypeChange={handleTaskTypeChange}
                  onSearchChange={handleSearchChange}
                  onFromChange={handleFromChange}
                  onToChange={handleToChange}
                  onReset={handleReset}
                />

                {executionQueueQuery.isLoading ? (
                  <SectionCard>
                    <SkeletonBlock rows={6} height="h-14" />
                  </SectionCard>
                ) : executionQueueQuery.isError ? (
                  <ErrorNotice title="Execution queue unavailable" message={queueErrorMessage} />
                ) : filteredTasks.length === 0 ? (
                  <EmptyState
                    title="No execution tasks match these filters"
                    message="The backend returned no queue rows for the selected support filters, or the current search and task-type filters narrowed the result set to zero."
                  />
                ) : (
                  <ExecutionQueueTable
                    tasks={filteredTasks}
                    selectedExecutionTaskId={selectedExecutionTaskId}
                    onSelect={handleSelectExecution}
                  />
                )}
              </div>
            }
            secondary={
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <MetricCard
                    label="Running now"
                    value={runningCount}
                    helper="Tasks currently in active execution."
                    tone={runningCount > 0 ? "warning" : "neutral"}
                  />
                  <MetricCard
                    label="Pending backlog"
                    value={pendingCount}
                    helper="Tasks waiting to enter the worker."
                    tone={pendingCount > 0 ? "warning" : "neutral"}
                  />
                </div>

                <ExecutionWorkerStatusCard
                  workerStatus={executionWorkerStatus}
                  isLoading={workerStatusQuery.isLoading}
                  error={workerStatusQuery.error}
                  onRefresh={() => {
                    void workerStatusQuery.refetch();
                  }}
                />

                <SectionCard>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="ui-section-label">Critical Escalations</p>
                      <h3 className="mt-1 text-subheading text-ink">Retry and dead-letter attention</h3>
                    </div>
                    <StatusChip tone={failedTasks.length > 0 ? "danger" : "neutral"}>
                      {failedTasks.length}
                    </StatusChip>
                  </div>

                  <div className="mt-4 space-y-3">
                    {failedTasks.length > 0 ? (
                      failedTasks.slice(0, 4).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleSelectExecution(task.id)}
                          className="w-full rounded-radius-md border border-slate-200/70 bg-white/92 px-4 py-3 text-left shadow-sm transition hover:bg-slate-50/80"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">{task.id}</p>
                              <p className="mt-1 text-sm text-steel">
                                {task.lastError ?? "Failure reason not exposed by the backend."}
                              </p>
                            </div>
                            <StatusChip tone="danger">{task.status}</StatusChip>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm leading-relaxed text-steel">
                        No failed or dead-lettered execution tasks are currently visible in the filtered queue.
                      </p>
                    )}
                  </div>
                </SectionCard>
              </div>
            }
          />
        )}
      </div>

      <ExecutionDetailDrawer executionTaskId={selectedExecutionTaskId} onClose={handleCloseDrawer} />
    </>
  );
};
