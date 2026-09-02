import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../../../lib/api/errors";
import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  uiButtonSecondaryClassName,
  uiCardClassName,
  uiDrawerBackdropClassName,
  uiDrawerHeaderClassName,
  uiDrawerSurfaceClassName,
  uiErrorNoticeClassName,
  uiLinkButtonClassName,
  uiSuccessNoticeClassName,
} from "../../../components/ui/classes";
import { buildApprovalGovernanceHref } from "../../approval-governance/route";
import { buildBuyerActionsHref } from "../../buyer-actions/route";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildInvestigationHref } from "../../investigation/route";
import { buildPoliciesHref } from "../../policies/route";
import { buildSupplyExecutionHref } from "../../supply-execution/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import {
  formatAutomationTier,
  formatConfidenceScore,
  formatDecisionStatus,
  formatDecisionType,
} from "../../decisions/presentation";
import {
  useCancelExecutionMutation,
  useExecutionAttempts,
  useExecutionDetail,
  useExecutionTimeline,
  useRetryExecutionMutation,
} from "../hooks";
import { workflowQueueKeys } from "../query-keys";
import {
  formatExecutionStatus,
  formatExecutionTaskType,
  formatTargetSystem,
  getExecutionStatusTone,
  isCancellableStatus,
  isRetryableStatus,
} from "../presentation";
import { ExecutionActionBar } from "./ExecutionActionBar";

interface ExecutionDetailDrawerProps {
  executionTaskId: string | null;
  onClose: () => void;
}

const cardClassName = uiCardClassName;
const linkClassName = uiLinkButtonClassName;

const renderJson = (value: unknown): string => JSON.stringify(value, null, 2);

const ErrorNotice = ({ title, message }: { title: string; message: string }): JSX.Element => (
  <div className={uiErrorNoticeClassName}>
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{message}</p>
  </div>
);

const SuccessNotice = ({ title, message }: { title: string; message: string }): JSX.Element => (
  <div className={uiSuccessNoticeClassName}>
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{message}</p>
  </div>
);

const LoadingBlock = (): JSX.Element => (
  <div className="space-y-3">
    <div className="h-7 w-2/3 animate-pulse rounded-full bg-slate-200/80" />
    <div className="h-24 animate-pulse rounded-[24px] bg-slate-200/75" />
    <div className="h-40 animate-pulse rounded-[24px] bg-slate-200/75" />
  </div>
);

export const ExecutionDetailDrawer = ({
  executionTaskId,
  onClose,
}: ExecutionDetailDrawerProps): JSX.Element | null => {
  const queryClient = useQueryClient();
  const executionQuery = useExecutionDetail(executionTaskId);
  const attemptsQuery = useExecutionAttempts(executionTaskId);
  const timelineQuery = useExecutionTimeline(executionTaskId);
  const retryMutation = useRetryExecutionMutation();
  const cancelMutation = useCancelExecutionMutation();

  useEffect(() => {
    retryMutation.reset();
    cancelMutation.reset();
  }, [cancelMutation, executionTaskId, retryMutation]);

  if (executionTaskId === null) {
    return null;
  }

  const task = executionQuery.data;
  const attempts = attemptsQuery.data ?? task?.attempts ?? [];
  const timelineItems = timelineQuery.data ?? [];
  const correlationIds = Array.from(
    new Set(
      timelineItems
        .map((item) => item.correlationId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const tone = task ? getExecutionStatusTone(task.status) : null;
  const canRetry = task ? isRetryableStatus(task.status) : false;
  const canCancel = task ? isCancellableStatus(task.status) : false;
  const isMutating = retryMutation.isPending || cancelMutation.isPending;

  const refreshAll = async (): Promise<void> => {
    await queryClient.refetchQueries({ queryKey: workflowQueueKeys.all, type: "active" });
  };

  const detailError =
    executionQuery.error && isApiError(executionQuery.error)
      ? `${executionQuery.error.message} Correlation: ${executionQuery.error.correlationId}.`
      : "The selected execution task could not be loaded.";

  const attemptsError =
    attemptsQuery.error && isApiError(attemptsQuery.error)
      ? `${attemptsQuery.error.message} Correlation: ${attemptsQuery.error.correlationId}.`
      : null;

  const timelineError =
    timelineQuery.error && isApiError(timelineQuery.error)
      ? `${timelineQuery.error.message} Correlation: ${timelineQuery.error.correlationId}.`
      : null;

  return (
    <div className={uiDrawerBackdropClassName}>
      <div className={`${uiDrawerSurfaceClassName} max-w-[46rem]`}>
        <div className={`flex items-start justify-between ${uiDrawerHeaderClassName}`}>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-steel">Execution Detail</p>
            <h3 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">
              Workflow operations drawer
            </h3>
            <p className="mt-2 text-sm leading-6 text-steel">
              Task state, linked decision context, retry history, and support diagnostics from the backend.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${uiButtonSecondaryClassName} !rounded-full px-3 py-2`}
          >
            Close
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {executionQuery.isLoading ? <LoadingBlock /> : null}

          {executionQuery.isError ? (
            <ErrorNotice title="Execution task load failed" message={detailError} />
          ) : null}

          {task ? (
            <div className="space-y-4">
              <section className={cardClassName}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-steel">
                        {formatExecutionTaskType(task.taskType)}
                      </span>
                      {tone ? (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.backgroundClassName} ${tone.textClassName}`}
                        >
                          {formatExecutionStatus(task.status)}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-4 text-2xl font-semibold text-ink">{task.id}</h4>
                    <p className="mt-3 text-sm leading-6 text-steel">
                      Target system: {formatTargetSystem(task.targetSystem)}
                    </p>
                  </div>

                  <ExecutionActionBar
                    canRetry={canRetry}
                    canCancel={canCancel}
                    isPending={isMutating}
                    onRefresh={() => {
                      void refreshAll();
                    }}
                    onRetry={() => retryMutation.mutate({ executionTaskId: task.id })}
                    onCancel={() => cancelMutation.mutate({ executionTaskId: task.id })}
                  />
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Decision id</dt>
                    <dd className="mt-2 break-all text-sm font-semibold text-ink">{task.decisionId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Actor</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">
                      {task.requestedByUserId ?? "System-managed"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Requested</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(task.requestedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Started</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(task.startedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Completed</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(task.completedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Updated</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(task.updatedAt)}</dd>
                  </div>
                </dl>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Retry count</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(task.retryCount)}</p>
                  </div>
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Next retry at</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(task.nextRetryAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Failed at</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(task.failedAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Latest correlation id</p>
                    <p className="mt-2 break-all text-sm font-semibold text-ink">
                      {correlationIds.length > 0 ? correlationIds[0] : "Not exposed"}
                    </p>
                  </div>
                </div>

                {task.lastError ? (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                    <p className="font-semibold">Failure reason</p>
                    <p className="mt-2 leading-6">{task.lastError}</p>
                  </div>
                ) : null}

                {retryMutation.isSuccess ? (
                  <div className="mt-4">
                    <SuccessNotice
                      title="Retry requested"
                      message="The backend accepted the retry request and the queue has been refetched."
                    />
                  </div>
                ) : null}
                {cancelMutation.isSuccess ? (
                  <div className="mt-4">
                    <SuccessNotice
                      title="Cancel requested"
                      message="The backend accepted the cancellation request and the queue has been refetched."
                    />
                  </div>
                ) : null}
                {retryMutation.error && isApiError(retryMutation.error) ? (
                  <div className="mt-4">
                    <ErrorNotice
                      title="Retry failed"
                      message={`${retryMutation.error.message} Correlation: ${retryMutation.error.correlationId}.`}
                    />
                  </div>
                ) : null}
                {cancelMutation.error && isApiError(cancelMutation.error) ? (
                  <div className="mt-4">
                    <ErrorNotice
                      title="Cancel failed"
                      message={`${cancelMutation.error.message} Correlation: ${cancelMutation.error.correlationId}.`}
                    />
                  </div>
                ) : null}
              </section>

              <section className={cardClassName}>
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Linked decision</p>
                <h5 className="mt-2 text-lg font-semibold text-ink">Decision reference</h5>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Decision type</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {formatDecisionType(task.decision.decisionType)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Decision status</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {formatDecisionStatus(task.decision.status)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Automation tier</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {formatAutomationTier(task.decision.automationTier)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-mist px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-steel">Confidence score</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {formatConfidenceScore(task.decision.confidenceScore)}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Policy reference</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">
                      {task.decision.policyId} v{task.decision.policyVersion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.15em] text-steel">Decision updated</dt>
                    <dd className="mt-2 text-sm font-semibold text-ink">
                      {formatDateTime(task.decision.updatedAt)}
                    </dd>
                  </div>
                </dl>

                {task.decision.skuId && task.decision.locationId ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to={buildApprovalGovernanceHref({
                        decisionId: task.decisionId,
                        policyId: task.decision.policyId,
                      })}
                      className={linkClassName}
                    >
                      Open approval governance
                    </Link>
                    <Link
                      to={buildPoliciesHref({ policyId: task.decision.policyId })}
                      className={linkClassName}
                    >
                      Open policy governance
                    </Link>
                    <Link
                      to={buildInvestigationHref(task.decision.skuId, task.decision.locationId)}
                      className={linkClassName}
                    >
                      Investigate SKU and location
                    </Link>
                    <Link
                      to={buildDataOpsHref({
                        skuId: task.decision.skuId,
                        locationId: task.decision.locationId,
                      })}
                      className={linkClassName}
                    >
                      Trace data & forecast ops
                    </Link>
                    <Link
                      to={buildSupportActionsHref({
                        executionId: task.id,
                        skuId: task.decision.skuId,
                        locationId: task.decision.locationId,
                      })}
                      className={linkClassName}
                    >
                      Open support actions
                    </Link>
                    <Link
                      to={buildSupplyExecutionHref({
                        skuId: task.decision.skuId,
                        locationId: task.decision.locationId,
                      })}
                      className={linkClassName}
                    >
                      Open supply execution
                    </Link>
                    <Link
                      to={buildBuyerActionsHref({
                        skuId: task.decision.skuId,
                        locationId: task.decision.locationId,
                      })}
                      className={linkClassName}
                    >
                      Open buyer actions
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to={buildApprovalGovernanceHref({
                        decisionId: task.decisionId,
                        policyId: task.decision.policyId,
                      })}
                      className={linkClassName}
                    >
                      Open approval governance
                    </Link>
                    <Link
                      to={buildPoliciesHref({ policyId: task.decision.policyId })}
                      className={linkClassName}
                    >
                      Open policy governance
                    </Link>
                    <Link
                      to={buildSupportActionsHref({
                        executionId: task.id,
                      })}
                      className={linkClassName}
                    >
                      Open support actions
                    </Link>
                  </div>
                )}
              </section>

              <section className={cardClassName}>
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Attempt history</p>
                <h5 className="mt-2 text-lg font-semibold text-ink">Retry history and error payloads</h5>

                {attemptsQuery.isLoading ? (
                  <div className="mt-4 h-24 animate-pulse rounded-[24px] bg-black/6" />
                ) : null}

                {attemptsError ? (
                  <div className="mt-4">
                    <ErrorNotice title="Attempt history failed to load" message={attemptsError} />
                  </div>
                ) : null}

                {attempts.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {attempts.map((attempt) => (
                      <details key={attempt.id} className="rounded-2xl bg-mist px-4 py-4">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                Attempt {attempt.attemptNumber} | {formatExecutionStatus(attempt.status)}
                              </p>
                              <p className="mt-1 text-sm text-steel">
                                Started {formatDateTime(attempt.startedAt)} | Completed{" "}
                                {formatDateTime(attempt.completedAt)}
                              </p>
                            </div>
                            <div className="text-right text-sm text-steel">
                              <p>Error code: {attempt.errorCode ?? "Not available"}</p>
                            </div>
                          </div>
                        </summary>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-steel">Error message</p>
                            <p className="mt-2 text-sm leading-6 text-ink">
                              {attempt.errorMessage ?? "No failure message persisted."}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-steel">Created</p>
                            <p className="mt-2 text-sm font-semibold text-ink">
                              {formatDateTime(attempt.createdAt)}
                            </p>
                          </div>
                        </div>

                        <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                          {renderJson(attempt.responsePayload)}
                        </pre>
                      </details>
                    ))}
                  </div>
                ) : !attemptsQuery.isLoading ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                    No execution attempts are persisted for this task yet.
                  </p>
                ) : null}
              </section>

              <section className={cardClassName}>
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Support diagnostics</p>
                <h5 className="mt-2 text-lg font-semibold text-ink">Timeline, correlation, and exposed metadata</h5>

                <div className="mt-4 rounded-2xl bg-mist px-4 py-4 text-sm text-steel">
                  <p className="font-semibold text-ink">Idempotency key</p>
                  <p className="mt-2">
                    The current API does not expose idempotency key records for execution tasks, so this panel can
                    only show correlation ids and persisted attempt history.
                  </p>
                </div>

                {correlationIds.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {correlationIds.map((correlationId) => (
                      <span
                        key={correlationId}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-ink"
                      >
                        {correlationId}
                      </span>
                    ))}
                  </div>
                ) : null}

                {timelineQuery.isLoading ? (
                  <div className="mt-4 h-24 animate-pulse rounded-[24px] bg-black/6" />
                ) : null}

                {timelineError ? (
                  <div className="mt-4">
                    <ErrorNotice title="Diagnostics timeline failed to load" message={timelineError} />
                  </div>
                ) : null}

                {timelineItems.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {timelineItems.map((item) => (
                      <details key={item.id} className="rounded-2xl bg-white px-4 py-4">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">{item.summary}</p>
                              <p className="mt-1 text-sm text-steel">
                                {item.type} | {formatDateTime(item.createdAt)}
                              </p>
                            </div>
                            <p className="text-sm text-steel">
                              {item.correlationId ? `Correlation ${item.correlationId}` : "No correlation id"}
                            </p>
                          </div>
                        </summary>
                        <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                          {renderJson(item.metadata)}
                        </pre>
                      </details>
                    ))}
                  </div>
                ) : !timelineQuery.isLoading ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                    No support timeline entries are available for this execution task.
                  </p>
                ) : null}
              </section>

              <section className={cardClassName}>
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Raw task payload</p>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <details className="rounded-2xl bg-mist px-4 py-3" open>
                    <summary className="cursor-pointer text-sm font-semibold text-ink">Execution payload</summary>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                      {renderJson(task.payload)}
                    </pre>
                  </details>
                  <details className="rounded-2xl bg-mist px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-ink">Decision payload</summary>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                      {renderJson(task.decision.proposedPayload)}
                    </pre>
                  </details>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
