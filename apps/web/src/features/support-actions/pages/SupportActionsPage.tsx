import { useMemo, useState } from "react";
import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { isApiError } from "../../../lib/api/errors";
import {
  uiButtonSecondaryClassName,
  uiPageStackClassName,
} from "../../../components/ui/classes";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { buildInvestigationHref } from "../../investigation/route";
import { useSession } from "../../session/SessionProvider";
import { ActionConfirmationDialog } from "../components/ActionConfirmationDialog";
import { ActionableQueueSection } from "../components/ActionableQueueSection";
import { ExecutionRecoverySection } from "../components/ExecutionRecoverySection";
import { ForecastRecoverySection } from "../components/ForecastRecoverySection";
import { IntegrationRecoverySection } from "../components/IntegrationRecoverySection";
import { OutcomeRecomputeSection } from "../components/OutcomeRecomputeSection";
import { SupportActionsEmptyState, SupportActionsErrorNotice, SupportActionsSectionSkeleton } from "../components/SupportActionsStates";
import { SupportFeedbackSection } from "../components/SupportFeedbackSection";
import {
  useSupportActionsConnections,
  useSupportActionsExecutionAttempts,
  useSupportActionsExecutionDetail,
  useSupportActionsExecutions,
  useSupportActionsFailedRecords,
  useSupportActionsForecastJobDetail,
  useSupportActionsForecastJobs,
  useSupportActionsForecastResults,
  useSupportActionsSyncRunDetail,
  useSupportActionsSyncRuns,
  useSupportActionsWorkerStatus,
  useSupportExecutionCancelMutation,
  useSupportExecutionRequeueMutation,
  useSupportForecastProcessMutation,
  useSupportForecastRequeueMutation,
  useSupportOutcomeRecomputeMutation,
  useSupportSyncCreateMutation,
  useSupportSyncProcessMutation,
} from "../hooks";
import { readSupportActionsRouteParams } from "../route";
import {
  deriveActionableQueue,
  deriveActionableSummaryCards,
  deriveExecutionRecoveryTasks,
  deriveForecastRecoveryJobs,
  deriveSyncRecoveryRuns,
} from "../selectors";
import type {
  ForecastJob,
  IntegrationSyncRun,
  OutcomeRecomputeResult,
  SupportActionFeedback,
  SupportActionableItem,
  SupportExecutionTask,
  SupportActionsRouteParams,
} from "../types";

type ConfirmationState =
  | { kind: "execution-requeue"; task: SupportExecutionTask }
  | { kind: "execution-cancel"; task: SupportExecutionTask }
  | { kind: "forecast-requeue"; forecastJob: ForecastJob }
  | { kind: "forecast-process"; forecastJob: ForecastJob }
  | { kind: "sync-create"; syncRun: IntegrationSyncRun }
  | { kind: "sync-process"; syncRun: IntegrationSyncRun };

const knownParams = [
  "executionId",
  "forecastJobId",
  "integrationConnectionId",
  "syncRunId",
  "skuId",
  "locationId",
] as const;

const toInputDate = (value: Date): string => value.toISOString().slice(0, 10);

const getDefaultOutcomeWindow = (): { startDate: string; endDate: string } => {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - 13);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
};

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

const pushFeedbackEntry = (
  current: SupportActionFeedback[],
  entry: Omit<SupportActionFeedback, "id" | "createdAt">,
): SupportActionFeedback[] => [
  {
    id: `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  },
  ...current,
].slice(0, 8);

const toIsoBoundary = (value: string, boundary: "start" | "end"): string =>
  boundary === "start"
    ? new Date(`${value}T00:00:00.000Z`).toISOString()
    : new Date(`${value}T23:59:59.999Z`).toISOString();

export const SupportActionsPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useMemo(() => readSupportActionsRouteParams(searchParams), [searchParams]);
  const defaultOutcomeWindow = useMemo(() => getDefaultOutcomeWindow(), []);

  const [feedbacks, setFeedbacks] = useState<SupportActionFeedback[]>([]);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const [lastOutcomeResult, setLastOutcomeResult] = useState<OutcomeRecomputeResult | null>(null);

  const executionsQuery = useSupportActionsExecutions();
  const executionDetailQuery = useSupportActionsExecutionDetail(context.executionId);
  const executionAttemptsQuery = useSupportActionsExecutionAttempts(context.executionId);
  const forecastJobsQuery = useSupportActionsForecastJobs();
  const forecastJobDetailQuery = useSupportActionsForecastJobDetail(context.forecastJobId);
  const forecastResultsQuery = useSupportActionsForecastResults(context.forecastJobId);
  const connectionsQuery = useSupportActionsConnections();
  const syncRunsQuery = useSupportActionsSyncRuns({
    integrationConnectionId: context.integrationConnectionId,
  });
  const syncRunDetailQuery = useSupportActionsSyncRunDetail(context.syncRunId);
  const failedRecordsQuery = useSupportActionsFailedRecords({
    integrationConnectionId: context.integrationConnectionId,
    syncRunId: context.syncRunId,
    resolved: false,
  });
  const workerStatusQuery = useSupportActionsWorkerStatus();

  const executionRequeueMutation = useSupportExecutionRequeueMutation();
  const executionCancelMutation = useSupportExecutionCancelMutation();
  const forecastRequeueMutation = useSupportForecastRequeueMutation();
  const forecastProcessMutation = useSupportForecastProcessMutation();
  const syncCreateMutation = useSupportSyncCreateMutation();
  const syncProcessMutation = useSupportSyncProcessMutation();
  const outcomeRecomputeMutation = useSupportOutcomeRecomputeMutation();

  const executions = executionsQuery.data ?? [];
  const forecastJobs = forecastJobsQuery.data ?? [];
  const connections = connectionsQuery.data ?? [];
  const syncRuns = syncRunsQuery.data ?? [];
  const failedRecords = failedRecordsQuery.data ?? [];
  const workerStatuses = workerStatusQuery.data ?? [];

  const executionRecoveryTasks = useMemo(
    () => deriveExecutionRecoveryTasks(executions, context),
    [context, executions],
  );
  const forecastRecoveryJobs = useMemo(
    () => deriveForecastRecoveryJobs(forecastJobs, context),
    [context, forecastJobs],
  );
  const syncRecoveryRuns = useMemo(() => deriveSyncRecoveryRuns(syncRuns), [syncRuns]);

  const summaryCards = useMemo(
    () =>
      deriveActionableSummaryCards({
        executionTasks: executionRecoveryTasks,
        forecastJobs: forecastRecoveryJobs,
        syncRuns: syncRecoveryRuns,
        failedRecords,
      }),
    [executionRecoveryTasks, failedRecords, forecastRecoveryJobs, syncRecoveryRuns],
  );

  const actionableQueue = useMemo(
    () =>
      deriveActionableQueue({
        executionTasks: executionRecoveryTasks,
        forecastJobs: forecastRecoveryJobs,
        syncRuns: syncRecoveryRuns,
        failedRecords,
        connections,
      }),
    [connections, executionRecoveryTasks, failedRecords, forecastRecoveryJobs, syncRecoveryRuns],
  );

  const selectedExecutionTask =
    executionDetailQuery.data ??
    executions.find((task) => task.id === context.executionId) ??
    null;
  const selectedExecutionAttempts = executionAttemptsQuery.data ?? selectedExecutionTask?.attempts ?? [];

  const selectedForecastJob =
    forecastJobDetailQuery.data ??
    forecastJobs.find((forecastJob) => forecastJob.id === context.forecastJobId) ??
    null;

  const selectedSyncRun =
    syncRunDetailQuery.data ??
    syncRuns.find((syncRun) => syncRun.id === context.syncRunId) ??
    null;

  const isDialogPending =
    executionRequeueMutation.isPending ||
    executionCancelMutation.isPending ||
    forecastRequeueMutation.isPending ||
    forecastProcessMutation.isPending ||
    syncCreateMutation.isPending ||
    syncProcessMutation.isPending;

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  };

  const applyRouteContext = (nextContext: Partial<SupportActionsRouteParams>) => {
    updateParams((params) => {
      knownParams.forEach((key) => {
        params.delete(key);
      });

      const mergedContext: SupportActionsRouteParams = {
        executionId: null,
        forecastJobId: null,
        integrationConnectionId: null,
        syncRunId: null,
        skuId: context.skuId,
        locationId: context.locationId,
        ...nextContext,
      };

      knownParams.forEach((key) => {
        const value = mergedContext[key];
        if (value) {
          params.set(key, value);
        }
      });
    });
  };

  const handleQueueSelect = (item: SupportActionableItem) => {
    applyRouteContext({
      executionId: item.executionId,
      forecastJobId: item.forecastJobId,
      integrationConnectionId: item.integrationConnectionId,
      syncRunId: item.syncRunId,
      skuId: item.skuId ?? context.skuId,
      locationId: item.locationId ?? context.locationId,
    });
  };

  const handleMutationError = (title: string, error: unknown, fallback: string) => {
    setFeedbacks((current) =>
      pushFeedbackEntry(current, {
        tone: "error",
        title,
        message: getApiErrorMessage(error, fallback),
      }),
    );
  };

  const handleConfirmDialog = async (reason: string): Promise<void> => {
    if (!confirmationState) {
      return;
    }

    try {
      switch (confirmationState.kind) {
        case "execution-requeue": {
          const result = await executionRequeueMutation.mutateAsync({
            executionTaskId: confirmationState.task.id,
            ...(reason ? { reason } : {}),
          });

          applyRouteContext({
            executionId: confirmationState.task.id,
            skuId: confirmationState.task.decision.skuId,
            locationId: confirmationState.task.decision.locationId,
          });
          setFeedbacks((current) =>
            pushFeedbackEntry(current, {
              tone: "success",
              title: "Execution requeued",
              message: `Execution task ${result.id} is now ${result.status}.`,
            }),
          );
          break;
        }
        case "execution-cancel": {
          const result = await executionCancelMutation.mutateAsync({
            executionTaskId: confirmationState.task.id,
            ...(reason ? { reason } : {}),
          });

          applyRouteContext({
            executionId: confirmationState.task.id,
            skuId: confirmationState.task.decision.skuId,
            locationId: confirmationState.task.decision.locationId,
          });
          setFeedbacks((current) =>
            pushFeedbackEntry(current, {
              tone: "success",
              title: "Execution cancelled",
              message: `Execution task ${result.id} is now ${result.status}.`,
            }),
          );
          break;
        }
        case "forecast-requeue": {
          const result = await forecastRequeueMutation.mutateAsync({
            forecastJobId: confirmationState.forecastJob.id,
            ...(reason ? { reason } : {}),
          });

          applyRouteContext({
            forecastJobId: confirmationState.forecastJob.id,
          });
          setFeedbacks((current) =>
            pushFeedbackEntry(current, {
              tone: "success",
              title: "Forecast requeued",
              message: `Forecast job ${result.id} reset to ${result.status}.`,
            }),
          );
          break;
        }
        case "forecast-process": {
          const result = await forecastProcessMutation.mutateAsync({
            forecastJobId: confirmationState.forecastJob.id,
          });

          applyRouteContext({
            forecastJobId: confirmationState.forecastJob.id,
          });
          setFeedbacks((current) =>
            pushFeedbackEntry(current, {
              tone: "success",
              title: "Forecast process request completed",
              message: result.processedNow
                ? `Forecast job ${result.job.id} processed now and returned ${result.results.length} persisted results.`
                : `Forecast job ${result.job.id} was already completed; the backend returned the persisted result set.`,
            }),
          );
          break;
        }
        case "sync-create": {
          const result = await syncCreateMutation.mutateAsync({
            connectionId: confirmationState.syncRun.integrationConnectionId,
            direction: confirmationState.syncRun.direction,
            syncType: confirmationState.syncRun.syncType,
          });

          applyRouteContext({
            integrationConnectionId: result.integrationConnectionId,
            syncRunId: result.id,
          });
          setFeedbacks((current) =>
            pushFeedbackEntry(current, {
              tone: "success",
              title: "Replacement sync created",
              message: `Created sync run ${result.id} in ${result.status} state for ${result.syncType}.`,
            }),
          );
          break;
        }
        case "sync-process": {
          const result = await syncProcessMutation.mutateAsync({
            syncRunId: confirmationState.syncRun.id,
          });

          applyRouteContext({
            integrationConnectionId: result.integrationConnectionId,
            syncRunId: result.id,
          });
          setFeedbacks((current) =>
            pushFeedbackEntry(current, {
              tone: "success",
              title: "Sync process request completed",
              message: `Sync run ${result.id} returned ${result.status}.`,
            }),
          );
          break;
        }
      }

      setConfirmationState(null);
    } catch (error) {
      switch (confirmationState.kind) {
        case "execution-requeue":
          handleMutationError("Execution requeue failed", error, "The backend rejected the execution requeue request.");
          break;
        case "execution-cancel":
          handleMutationError("Execution cancel failed", error, "The backend rejected the execution cancel request.");
          break;
        case "forecast-requeue":
          handleMutationError("Forecast requeue failed", error, "The backend rejected the forecast requeue request.");
          break;
        case "forecast-process":
          handleMutationError("Forecast processing failed", error, "The backend rejected the forecast process request.");
          break;
        case "sync-create":
          handleMutationError("Replacement sync failed", error, "The backend rejected the replacement sync request.");
          break;
        case "sync-process":
          handleMutationError("Sync processing failed", error, "The backend rejected the sync process request.");
          break;
      }
    }
  };

  const handleOutcomeRecompute = async (input: { startDate: string; endDate: string }) => {
    try {
      const result = await outcomeRecomputeMutation.mutateAsync({
        measurementWindowStart: toIsoBoundary(input.startDate, "start"),
        measurementWindowEnd: toIsoBoundary(input.endDate, "end"),
      });

      setLastOutcomeResult(result);
      setFeedbacks((current) =>
        pushFeedbackEntry(current, {
          tone: "success",
          title: "Outcomes recomputed",
          message: `Recomputed window ${input.startDate} to ${input.endDate}. Stockouts ${result.stockoutCount}, fill-rate measurements ${result.fillRateCount}, forecast errors ${result.forecastErrorCount}.`,
        }),
      );
    } catch (error) {
      handleMutationError(
        "Outcome recompute failed",
        error,
        "The backend rejected the outcome recompute request.",
      );
    }
  };

  const dialogConfig =
    confirmationState === null
      ? null
      : confirmationState.kind === "execution-requeue"
        ? {
            title: "Requeue execution task",
            description:
              "This uses the backend support requeue route and preserves the server-owned execution lifecycle. Add an optional reason for the audit trail if useful.",
            confirmLabel: "Requeue execution",
            tone: "default" as const,
            showReasonInput: true,
          }
        : confirmationState.kind === "execution-cancel"
          ? {
              title: "Cancel queued execution task",
              description:
                "This uses the backend workflow cancel route. Only queued tasks should be cancellable here, and the action will be audited by the backend.",
              confirmLabel: "Cancel execution",
              tone: "critical" as const,
              showReasonInput: true,
            }
          : confirmationState.kind === "forecast-requeue"
            ? {
                title: "Requeue forecast job",
                description:
                  "This resets the selected forecast job back to pending through the backend support route so it can be processed again.",
                confirmLabel: "Requeue forecast",
                tone: "default" as const,
                showReasonInput: true,
              }
            : confirmationState.kind === "forecast-process"
              ? {
                  title: "Process pending forecast job",
                  description:
                    "This calls the explicit forecast process endpoint. If the job is already completed, the backend will return the persisted result set instead of rerunning it.",
                  confirmLabel: "Process forecast",
                  tone: "default" as const,
                  showReasonInput: false,
                }
              : confirmationState.kind === "sync-create"
                ? {
                    title: "Trigger replacement sync",
                    description:
                      "This creates a fresh sync run with the same connection, direction, and sync type as the selected run. The backend does not expose a direct sync retry mutation today.",
                    confirmLabel: "Create replacement sync",
                    tone: "default" as const,
                    showReasonInput: false,
                  }
                : {
                    title: "Process pending sync run",
                    description:
                      "This calls the explicit sync process endpoint for the selected pending run.",
                    confirmLabel: "Process sync",
                    tone: "default" as const,
                    showReasonInput: false,
                  };

  const summaryIsLoading =
    session.isConfigured &&
    executionsQuery.isLoading &&
    forecastJobsQuery.isLoading &&
    syncRunsQuery.isLoading &&
    failedRecordsQuery.isLoading;

  if (!session.isConfigured) {
    return (
      <SupportActionsEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real backend."
      />
    );
  }

  return (
    <>
      <div className={uiPageStackClassName}>
        <PageIntro
          eyebrow="Support Actions"
          title="Operational remediation workspace"
          description="Recover stuck executions, forecast jobs, sync runs, and measured outcomes using the explicit backend support mutations that exist today."
          actions={
            <>
              <Link to="/workflow" className={uiButtonSecondaryClassName}>
                Open workflow
              </Link>
              <Link to="/data-ops" className={uiButtonSecondaryClassName}>
                Open data ops
              </Link>
              {context.skuId && context.locationId ? (
                <Link
                  to={buildInvestigationHref(context.skuId, context.locationId)}
                  className={uiButtonSecondaryClassName}
                >
                  Open investigation
                </Link>
              ) : null}
            </>
          }
          meta={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone={actionableQueue.length > 0 ? "warning" : "neutral"}>
                {actionableQueue.length} actionable items
              </StatusChip>
              <StatusChip tone={feedbacks.length > 0 ? "info" : "neutral"}>
                {feedbacks.length} recent feedback entries
              </StatusChip>
              <StatusChip tone={workerStatuses.length > 0 ? "info" : "neutral"}>
                {workerStatuses.length} worker snapshots
              </StatusChip>
            </div>
          }
        />

        {summaryIsLoading ? (
          <SupportActionsSectionSkeleton rows={5} />
        ) : (
          <ActionableQueueSection
            cards={summaryCards}
            items={actionableQueue}
            selectedExecutionId={context.executionId}
            selectedForecastJobId={context.forecastJobId}
            selectedSyncRunId={context.syncRunId}
            onSelectItem={handleQueueSelect}
          />
        )}

        {executionsQuery.isError || forecastJobsQuery.isError || syncRunsQuery.isError || failedRecordsQuery.isError ? (
          <SupportActionsErrorNotice
            title="Some remediation inputs could not be loaded"
            message={getApiErrorMessage(
              executionsQuery.error ??
                forecastJobsQuery.error ??
                syncRunsQuery.error ??
                failedRecordsQuery.error,
              "One or more operational remediation queries failed.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <div className="space-y-6">
              {executionsQuery.isLoading && executionRecoveryTasks.length === 0 ? (
                <SupportActionsSectionSkeleton rows={5} />
              ) : (
                <ExecutionRecoverySection
                  tasks={executionRecoveryTasks}
                  selectedExecutionTaskId={context.executionId}
                  selectedExecutionTask={selectedExecutionTask}
                  attempts={selectedExecutionAttempts}
                  isDetailLoading={executionDetailQuery.isLoading}
                  isAttemptsLoading={executionAttemptsQuery.isLoading}
                  detailError={
                    executionDetailQuery.isError
                      ? getApiErrorMessage(
                          executionDetailQuery.error,
                          "The selected execution task could not be loaded.",
                        )
                      : null
                  }
                  attemptsError={
                    executionAttemptsQuery.isError
                      ? getApiErrorMessage(
                          executionAttemptsQuery.error,
                          "Execution attempt history could not be loaded.",
                        )
                      : null
                  }
                  isActionPending={executionRequeueMutation.isPending || executionCancelMutation.isPending}
                  onSelectExecutionTask={(executionTaskId) =>
                    applyRouteContext({
                      executionId: executionTaskId,
                      forecastJobId: null,
                      syncRunId: null,
                      integrationConnectionId: context.integrationConnectionId,
                    })
                  }
                  onRequestRequeue={(task) => setConfirmationState({ kind: "execution-requeue", task })}
                  onRequestCancel={(task) => setConfirmationState({ kind: "execution-cancel", task })}
                />
              )}

              {forecastJobsQuery.isLoading && forecastRecoveryJobs.length === 0 ? (
                <SupportActionsSectionSkeleton rows={5} />
              ) : (
                <ForecastRecoverySection
                  forecastJobs={forecastRecoveryJobs}
                  selectedForecastJobId={context.forecastJobId}
                  selectedForecastJob={selectedForecastJob}
                  forecastResults={forecastResultsQuery.data ?? []}
                  isDetailLoading={forecastJobDetailQuery.isLoading}
                  isResultsLoading={forecastResultsQuery.isLoading}
                  detailError={
                    forecastJobDetailQuery.isError
                      ? getApiErrorMessage(
                          forecastJobDetailQuery.error,
                          "The selected forecast job could not be loaded.",
                        )
                      : null
                  }
                  resultsError={
                    forecastResultsQuery.isError
                      ? getApiErrorMessage(
                          forecastResultsQuery.error,
                          "The selected forecast job results could not be loaded.",
                        )
                      : null
                  }
                  isActionPending={forecastRequeueMutation.isPending || forecastProcessMutation.isPending}
                  onSelectForecastJob={(forecastJobId) =>
                    applyRouteContext({
                      forecastJobId,
                      executionId: context.executionId,
                      integrationConnectionId: context.integrationConnectionId,
                      syncRunId: context.syncRunId,
                    })
                  }
                  onRequestRequeue={(forecastJob) => setConfirmationState({ kind: "forecast-requeue", forecastJob })}
                  onRequestProcess={(forecastJob) => setConfirmationState({ kind: "forecast-process", forecastJob })}
                />
              )}
            </div>
          }
          secondary={
            <div className="space-y-6">
              {connectionsQuery.isLoading && syncRunsQuery.isLoading && connections.length === 0 && syncRecoveryRuns.length === 0 ? (
                <SupportActionsSectionSkeleton rows={5} />
              ) : (
                <IntegrationRecoverySection
                  connections={connections}
                  syncRuns={syncRecoveryRuns}
                  failedRecords={failedRecords}
                  selectedConnectionId={context.integrationConnectionId}
                  selectedSyncRunId={context.syncRunId}
                  selectedSyncRun={selectedSyncRun}
                  isDetailLoading={syncRunDetailQuery.isLoading}
                  detailError={
                    syncRunDetailQuery.isError
                      ? getApiErrorMessage(syncRunDetailQuery.error, "The selected sync run could not be loaded.")
                      : null
                  }
                  isActionPending={syncCreateMutation.isPending || syncProcessMutation.isPending}
                  onSelectConnection={(integrationConnectionId) =>
                    applyRouteContext({
                      integrationConnectionId,
                      syncRunId: null,
                      executionId: context.executionId,
                      forecastJobId: context.forecastJobId,
                    })
                  }
                  onSelectSyncRun={(syncRunId) =>
                    applyRouteContext({
                      integrationConnectionId: context.integrationConnectionId,
                      syncRunId,
                      executionId: context.executionId,
                      forecastJobId: context.forecastJobId,
                    })
                  }
                  onProcessSyncRun={(syncRun) => setConfirmationState({ kind: "sync-process", syncRun })}
                  onTriggerReplacementSync={(syncRun) => setConfirmationState({ kind: "sync-create", syncRun })}
                />
              )}
            </div>
          }
        />

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <OutcomeRecomputeSection
              initialStartDate={defaultOutcomeWindow.startDate}
              initialEndDate={defaultOutcomeWindow.endDate}
              isPending={outcomeRecomputeMutation.isPending}
              onSubmit={handleOutcomeRecompute}
              lastResult={lastOutcomeResult}
            />
          }
          secondary={
            workerStatusQuery.isLoading && workerStatuses.length === 0 ? (
              <SupportActionsSectionSkeleton rows={4} />
            ) : workerStatusQuery.isError ? (
              <SupportActionsErrorNotice
                title="Worker diagnostics unavailable"
                message={getApiErrorMessage(workerStatusQuery.error, "Worker diagnostics could not be loaded.")}
              />
            ) : (
              <SupportFeedbackSection feedbacks={feedbacks} workerStatuses={workerStatuses} />
            )
          }
        />
      </div>

      <ActionConfirmationDialog
        open={dialogConfig !== null}
        title={dialogConfig?.title ?? ""}
        description={dialogConfig?.description ?? ""}
        confirmLabel={dialogConfig?.confirmLabel ?? "Confirm"}
        tone={dialogConfig?.tone}
        showReasonInput={dialogConfig?.showReasonInput}
        pending={isDialogPending}
        onClose={() => {
          if (!isDialogPending) {
            setConfirmationState(null);
          }
        }}
        onConfirm={handleConfirmDialog}
      />
    </>
  );
};
