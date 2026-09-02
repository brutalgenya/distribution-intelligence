import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildBuyerActionsHref } from "../../buyer-actions/route";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildInvestigationHref } from "../../investigation/route";
import { buildSupplyExecutionHref } from "../../supply-execution/route";
import { formatExecutionStatus, formatExecutionTaskType } from "../../workflow/presentation";
import { canCancelExecution, canRequeueExecution } from "../selectors";
import type { SupportExecutionAttempt, SupportExecutionTask } from "../types";
import { UnsupportedActionNotice } from "./SupportActionsStates";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { DataField } from "../../../components/ui/DataField";

interface ExecutionRecoverySectionProps {
  tasks: SupportExecutionTask[];
  selectedExecutionTaskId: string | null;
  selectedExecutionTask: SupportExecutionTask | null;
  attempts: SupportExecutionAttempt[];
  isDetailLoading: boolean;
  isAttemptsLoading: boolean;
  detailError: string | null;
  attemptsError: string | null;
  isActionPending: boolean;
  onSelectExecutionTask: (executionTaskId: string | null) => void;
  onRequestRequeue: (task: SupportExecutionTask) => void;
  onRequestCancel: (task: SupportExecutionTask) => void;
}

const renderJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const ExecutionRecoverySection = ({
  tasks,
  selectedExecutionTaskId,
  selectedExecutionTask,
  attempts,
  isDetailLoading,
  isAttemptsLoading,
  detailError,
  attemptsError,
  isActionPending,
  onSelectExecutionTask,
  onRequestRequeue,
  onRequestCancel,
}: ExecutionRecoverySectionProps): JSX.Element => {
  const visibleTasks =
    selectedExecutionTaskId === null
      ? tasks.slice(0, 10)
      : [
          ...tasks.filter((task) => task.id === selectedExecutionTaskId),
          ...tasks.filter((task) => task.id !== selectedExecutionTaskId).slice(0, 9),
        ];

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Execution recovery"
        title="Execution recovery"
        description="Retry failed execution tasks and cancel queued tasks where the backend exposes those operations. Running and successful tasks stay read-only here."
      />

      <SectionCard padding="none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
          <div>
            <p className="ui-section-label mb-1">Recoverable executions</p>
            <h4 className="text-xl font-semibold tracking-tight text-ink">Execution tasks</h4>
          </div>
          {selectedExecutionTaskId ? (
            <button
              type="button"
              onClick={() => onSelectExecutionTask(null)}
              className={uiButtonSecondaryClassName}
            >
              Clear selected execution
            </button>
          ) : null}
        </div>

        {tasks.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto pb-4">
            <table className="min-w-full border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-[10px] uppercase font-bold tracking-widest text-steel">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">Execution task</th>
                  <th className="px-5 py-4 whitespace-nowrap">Decision</th>
                  <th className="px-5 py-4 whitespace-nowrap">Status</th>
                  <th className="px-5 py-4 whitespace-nowrap">Failure reason</th>
                  <th className="px-5 py-4 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTasks.map((task) => {
                  const canRequeue = canRequeueExecution(task);
                  const canCancel = canCancelExecution(task);

                  return (
                    <tr
                      key={task.id}
                      className={[
                        "cursor-pointer transition-colors duration-200 hover:bg-slate-50",
                        selectedExecutionTaskId === task.id ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60" : "bg-white",
                      ].join(" ")}
                      onClick={() => onSelectExecutionTask(task.id)}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-ink font-mono">{task.id}</p>
                        <p className="mt-1 text-sm font-medium text-ink">{formatExecutionTaskType(task.taskType)}</p>
                        <p className="mt-1 text-sm text-steel whitespace-nowrap">Req {formatDateTime(task.requestedAt)}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-sm text-ink break-all max-w-xs">
                        <p className="font-mono">{task.decisionId}</p>
                        <p className="mt-1 text-steel">
                          {task.decision.skuId && task.decision.locationId
                            ? `${task.decision.skuId} @ ${task.decision.locationId}`
                            : "No SKU/location reference"}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink">{formatExecutionStatus(task.status)}</td>
                      <td className="max-w-sm px-5 py-4 align-top text-sm leading-relaxed text-steel">
                        {task.lastError ?? "No failure reason persisted."}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {canRequeue ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRequestRequeue(task);
                              }}
                              disabled={isActionPending}
                              className={`${uiButtonSecondaryClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              Requeue
                            </button>
                          ) : null}
                          {canCancel ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRequestCancel(task);
                              }}
                              disabled={isActionPending}
                              className="rounded-radius-md border border-rose-200/50 bg-rose-50/50 px-3 py-1.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100/50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          ) : null}
                          {!canRequeue && !canCancel ? <span className="text-sm text-steel opacity-80">No action</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
             <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                <EmptyState title="No execution tasks" message="No execution tasks currently require support intervention." />
             </div>
          </div>
        )}
      </SectionCard>

      {selectedExecutionTaskId ? (
        isDetailLoading && selectedExecutionTask === null ? (
          <div className="rounded-radius-md border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="h-6 w-56 animate-pulse rounded-radius-full bg-slate-200" />
            <div className="mt-5 h-36 animate-pulse rounded-radius-md bg-slate-100" />
          </div>
        ) : detailError ? (
          <UnsupportedActionNotice title="Execution detail unavailable" message={detailError} />
        ) : selectedExecutionTask ? (
          <div className="rounded-radius-lg border border-slate-200/60 bg-white p-6 shadow-sm overflow-hidden mt-2">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between border-b border-slate-200/60 pb-5 mb-5">
              <div>
                <p className="ui-section-label mb-1">Selected execution</p>
                <h4 className="text-2xl font-semibold tracking-tight text-ink font-mono">{selectedExecutionTask.id}</h4>
                <div className="mt-2 flex items-center gap-2">
                   <span className="font-medium text-ink text-sm">{formatExecutionTaskType(selectedExecutionTask.taskType)}</span>
                   <span className="text-sm text-steel opacity-40">·</span>
                   <span className="text-sm font-medium text-ink">{formatExecutionStatus(selectedExecutionTask.status)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <Link
                  to={`/workflow?executionId=${selectedExecutionTask.id}`}
                  className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
                >
                  Open workflow detail
                </Link>
                {selectedExecutionTask.decision.skuId && selectedExecutionTask.decision.locationId ? (
                  <>
                    <Link
                      to={buildInvestigationHref(
                        selectedExecutionTask.decision.skuId,
                        selectedExecutionTask.decision.locationId,
                      )}
                      className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
                    >
                      Investigate SKU/location
                    </Link>
                    <Link
                      to={buildDataOpsHref({
                        skuId: selectedExecutionTask.decision.skuId,
                        locationId: selectedExecutionTask.decision.locationId,
                      })}
                      className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
                    >
                      Trace upstream ops
                    </Link>
                    <Link
                      to={buildSupplyExecutionHref({
                        skuId: selectedExecutionTask.decision.skuId,
                        locationId: selectedExecutionTask.decision.locationId,
                      })}
                      className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
                    >
                      Open supply execution
                    </Link>
                    <Link
                      to={buildBuyerActionsHref({
                        skuId: selectedExecutionTask.decision.skuId,
                        locationId: selectedExecutionTask.decision.locationId,
                      })}
                      className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
                    >
                      Open buyer actions
                    </Link>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
                <DataField label="Retry count" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(selectedExecutionTask.retryCount)}</span>} />
              </div>
              <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
                <DataField label="Requested by" value={<span className="font-semibold text-ink break-all">{selectedExecutionTask.requestedByUserId ?? "System-managed"}</span>} />
              </div>
              <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
                <DataField label="Next retry" value={formatDateTime(selectedExecutionTask.nextRetryAt)} />
              </div>
               <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
                <DataField label="Updated" value={formatDateTime(selectedExecutionTask.updatedAt)} />
              </div>
            </div>

            {selectedExecutionTask.lastError ? (
              <div className="mt-5 rounded-radius-md border border-rose-200/50 bg-rose-50/50 p-4 text-sm text-rose-800 shadow-sm mb-6">
                <p className="font-semibold">Latest failure reason</p>
                <p className="mt-2 leading-relaxed opacity-90">{selectedExecutionTask.lastError}</p>
              </div>
            ) : null}

            <div className="grid gap-6">
              <div>
                <h4 className="ui-section-label mb-4">Attempt history</h4>
                {isAttemptsLoading ? (
                  <div className="h-28 animate-pulse rounded-radius-md bg-slate-100" />
                ) : attemptsError ? (
                  <div className="rounded-radius-md border border-rose-200/50 bg-rose-50/50 p-4 text-sm text-rose-800 shadow-sm">
                    <p className="font-semibold">Attempt history unavailable</p>
                    <p className="mt-2 leading-relaxed opacity-90">{attemptsError}</p>
                  </div>
                ) : attempts.length > 0 ? (
                  <div className="space-y-3">
                    {attempts.map((attempt) => (
                      <details key={attempt.id} className="group rounded-radius-md border border-slate-200/60 bg-white shadow-sm overflow-hidden open:pb-4">
                        <summary className="cursor-pointer list-none p-4 transition-colors group-hover:bg-slate-50/50">
                          <p className="text-sm font-semibold text-ink">
                             Attempt {attempt.attemptNumber} <span className="mx-1.5 opacity-40">·</span> {formatExecutionStatus(attempt.status)}
                          </p>
                        </summary>
                         <div className="px-4 border-t border-slate-100 pt-3 mt-1">
                          <p className="text-sm leading-relaxed text-steel mb-2">
                            Started <span className="font-medium text-ink">{formatDateTime(attempt.startedAt)}</span> <span className="mx-1.5 opacity-40">·</span> Completed <span className="font-medium text-ink">{formatDateTime(attempt.completedAt)}</span>
                          </p>
                          <p className="text-sm text-ink bg-slate-50 p-3 rounded-radius-sm border border-slate-100">
                            {attempt.errorMessage ?? "No persisted error message."}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                      <EmptyState title="No attempts" message="No execution attempts are persisted for this task yet." />
                  </div>
                )}
              </div>

              <details className="group rounded-radius-md border border-slate-200/60 bg-slate-50 shadow-sm overflow-hidden h-fit">
                <summary className="cursor-pointer list-none p-4 font-semibold text-ink transition-colors group-hover:bg-slate-100/50">Execution payload</summary>
                <div className="px-5 pb-5">
                  <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
                    {renderJson(selectedExecutionTask.payload)}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        ) : null
      ) : null}
    </section>
  );
};
