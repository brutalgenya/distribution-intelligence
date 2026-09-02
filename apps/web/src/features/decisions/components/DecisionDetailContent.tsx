import { Link } from "react-router-dom";

import { isApiError } from "../../../lib/api/errors";
import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  uiButtonSecondaryClassName,
  uiCardClassName,
  uiErrorNoticeClassName,
  uiLinkButtonClassName,
} from "../../../components/ui/classes";
import { buildApprovalGovernanceHref } from "../../approval-governance/route";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildInvestigationHref } from "../../investigation/route";
import { buildPoliciesHref } from "../../policies/route";
import {
  formatAutomationTier,
  formatConfidenceScore,
  formatDecisionStatus,
  formatDecisionType,
  getDecisionScopeLabel,
  getPayloadFactRows,
  getStatusTone,
  summarizeDecision,
} from "../presentation";
import {
  useApproveApprovalMutation,
  useDecisionDetail,
  useLatestDecisionExplanation,
  useLatestDecisionOutcome,
  usePendingApprovalTask,
  useRejectApprovalMutation,
  useRequestApprovalMutation,
} from "../hooks";
import { DecisionActions } from "./DecisionActions";

interface DecisionDetailContentProps {
  decisionId: string;
  mode?: "panel" | "drawer";
  onClose?: () => void;
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

const LoadingBlock = (): JSX.Element => (
  <div className="space-y-3 p-6">
    <div className="h-7 w-2/3 animate-pulse rounded-full bg-slate-200/80" />
    <div className="h-24 animate-pulse rounded-[24px] bg-slate-200/75" />
    <div className="h-32 animate-pulse rounded-[24px] bg-slate-200/75" />
  </div>
);

export const DecisionDetailContent = ({
  decisionId,
  mode = "panel",
  onClose,
}: DecisionDetailContentProps): JSX.Element => {
  const decisionQuery = useDecisionDetail(decisionId);
  const approvalTaskQuery = usePendingApprovalTask(decisionId);
  const explanationQuery = useLatestDecisionExplanation(decisionId);
  const outcomeQuery = useLatestDecisionOutcome(decisionId);
  const requestApprovalMutation = useRequestApprovalMutation();
  const approveMutation = useApproveApprovalMutation();
  const rejectMutation = useRejectApprovalMutation();

  const decision = decisionQuery.data;
  const approvalTask = approvalTaskQuery.data ?? null;
  const latestExplanation = explanationQuery.data ?? null;
  const latestOutcome = outcomeQuery.data ?? null;
  const isMutating =
    requestApprovalMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  const detailError =
    decisionQuery.error && isApiError(decisionQuery.error)
      ? `${decisionQuery.error.message} Correlation: ${decisionQuery.error.correlationId}.`
      : "The selected decision could not be loaded.";

  const approvalError =
    approvalTaskQuery.error && isApiError(approvalTaskQuery.error)
      ? `${approvalTaskQuery.error.message} Correlation: ${approvalTaskQuery.error.correlationId}.`
      : null;

  const explanationJson =
    latestExplanation &&
    typeof latestExplanation.explanationJson === "object" &&
    latestExplanation.explanationJson !== null
      ? (latestExplanation.explanationJson as Record<string, unknown>)
      : null;

  const tone = decision ? getStatusTone(decision.status) : null;
  const payloadFacts = decision ? getPayloadFactRows(decision) : [];
  const isDrawer = mode === "drawer";

  return (
    <div className="flex h-full flex-col">
      <div className={isDrawer ? "ui-drawer-header" : "px-5 py-5 sm:px-6"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-steel">
              {isDrawer ? "Decision Detail" : "Decision Inspector"}
            </p>
            <h3 className="mt-2 text-heading text-ink">
              {isDrawer ? "Decision inbox drawer" : "Selected recommendation"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-steel">
              Server-driven detail, approval state, explanation, and linked outcome data.
            </p>
          </div>

          {onClose ? (
            <button type="button" onClick={onClose} className={`${uiButtonSecondaryClassName} !px-3`}>
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {decisionQuery.isLoading ? <LoadingBlock /> : null}

        {decisionQuery.isError ? <ErrorNotice title="Decision load failed" message={detailError} /> : null}

        {decision ? (
          <div className="space-y-4">
            <section className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-steel">
                      {formatDecisionType(decision.decisionType)}
                    </span>
                    {tone ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.backgroundClassName} ${tone.textClassName}`}
                      >
                        {formatDecisionStatus(decision.status)}
                      </span>
                    ) : null}
                  </div>
                  <h4 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-ink">
                    {summarizeDecision(decision)}
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-steel">{getDecisionScopeLabel(decision)}</p>
                </div>

                <div className="rounded-2xl bg-black/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-steel">Confidence score</p>
                  <p className="mt-2 text-xl font-semibold text-ink">
                    {formatConfidenceScore(decision.confidenceScore)}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Automation tier</dt>
                  <dd className="mt-2 text-sm font-semibold text-ink">
                    {formatAutomationTier(decision.automationTier)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Updated</dt>
                  <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(decision.updatedAt)}</dd>
                </div>
              </dl>

              {payloadFacts.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {payloadFacts.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-mist px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">{item.label}</p>
                      <p className="mt-2 text-base font-semibold text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={buildApprovalGovernanceHref({
                    decisionId: decision.id,
                    policyId: decision.policyId,
                  })}
                  className={linkClassName}
                >
                  Open approval governance
                </Link>
                <Link to={buildPoliciesHref({ policyId: decision.policyId })} className={linkClassName}>
                  Open policy governance
                </Link>
                {decision.skuId && decision.locationId ? (
                  <>
                    <Link
                      to={buildInvestigationHref(decision.skuId, decision.locationId)}
                      className={linkClassName}
                    >
                      Investigate SKU and location
                    </Link>
                    <Link
                      to={buildDataOpsHref({
                        skuId: decision.skuId,
                        locationId: decision.locationId,
                      })}
                      className={linkClassName}
                    >
                      Trace data and forecast ops
                    </Link>
                  </>
                ) : null}
              </div>
            </section>

            <section className={cardClassName}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-steel">Approval Workflow</p>
                  <h5 className="mt-2 text-lg font-semibold text-ink">Approval task state</h5>
                </div>
                <DecisionActions
                  canRequestApproval={decision.status === "proposed" && approvalTask === null}
                  canApproveOrReject={approvalTask?.status === "pending"}
                  isPending={isMutating}
                  onRequestApproval={() => requestApprovalMutation.mutate(decision.id)}
                  onApprove={() => {
                    if (approvalTask) {
                      approveMutation.mutate(approvalTask.id);
                    }
                  }}
                  onReject={() => {
                    if (approvalTask) {
                      rejectMutation.mutate(approvalTask.id);
                    }
                  }}
                />
              </div>

              <div className="mt-4 space-y-3">
                {approvalError ? <ErrorNotice title="Approval task load failed" message={approvalError} /> : null}

                {approvalTask ? (
                  <div className="rounded-2xl bg-mist px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-steel">Pending approval</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{approvalTask.purpose}</p>
                      </div>
                      <span className="rounded-full bg-ember/12 px-3 py-1 text-xs font-semibold text-ember">
                        {approvalTask.status}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.15em] text-steel">Assigned to</dt>
                        <dd className="mt-2 text-sm text-ink">
                          {approvalTask.assignedToUserId ?? "Unassigned"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.15em] text-steel">Requested</dt>
                        <dd className="mt-2 text-sm text-ink">{formatDateTime(approvalTask.requestedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-4 text-sm text-steel">
                    No pending approval task is linked to this decision.
                  </div>
                )}

                {requestApprovalMutation.error && isApiError(requestApprovalMutation.error) ? (
                  <ErrorNotice
                    title="Request approval failed"
                    message={`${requestApprovalMutation.error.message} Correlation: ${requestApprovalMutation.error.correlationId}.`}
                  />
                ) : null}
                {approveMutation.error && isApiError(approveMutation.error) ? (
                  <ErrorNotice
                    title="Approve failed"
                    message={`${approveMutation.error.message} Correlation: ${approveMutation.error.correlationId}.`}
                  />
                ) : null}
                {rejectMutation.error && isApiError(rejectMutation.error) ? (
                  <ErrorNotice
                    title="Reject failed"
                    message={`${rejectMutation.error.message} Correlation: ${rejectMutation.error.correlationId}.`}
                  />
                ) : null}
              </div>
            </section>

            <section className={cardClassName}>
              <p className="text-xs uppercase tracking-[0.2em] text-steel">Deterministic rationale</p>
              <h5 className="mt-2 text-lg font-semibold text-ink">Reasons, scores, and artifacts</h5>

              <div className="mt-5 grid gap-5 xl:grid-cols-3">
                <div>
                  <h6 className="text-sm font-semibold uppercase tracking-[0.15em] text-steel">Reasons</h6>
                  <div className="mt-3 space-y-3">
                    {decision.reasons.length > 0 ? (
                      decision.reasons.map((reason) => (
                        <div key={reason.id} className="rounded-2xl bg-mist px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-steel">{reason.code}</p>
                          <p className="mt-2 text-sm leading-6 text-ink">{reason.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                        No deterministic reasons were persisted.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h6 className="text-sm font-semibold uppercase tracking-[0.15em] text-steel">Scores</h6>
                  <div className="mt-3 space-y-3">
                    {decision.scores.length > 0 ? (
                      decision.scores.map((score) => (
                        <div key={score.id} className="rounded-2xl bg-mist px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-steel">{score.metric}</p>
                          <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(score.value)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                        No persisted scoring metrics.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h6 className="text-sm font-semibold uppercase tracking-[0.15em] text-steel">Artifacts</h6>
                  <div className="mt-3 space-y-3">
                    {decision.artifacts.length > 0 ? (
                      decision.artifacts.map((artifact) => (
                        <details key={artifact.id} className="rounded-2xl bg-mist px-4 py-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
                            {artifact.artifactType}
                          </summary>
                          <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                            {renderJson(artifact.payload)}
                          </pre>
                        </details>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                        No persisted artifacts.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className={cardClassName}>
              <p className="text-xs uppercase tracking-[0.2em] text-steel">Advisory explanation</p>
              <h5 className="mt-2 text-lg font-semibold text-ink">Latest explanation</h5>

              {explanationQuery.isLoading ? (
                <div className="mt-4 h-24 animate-pulse rounded-[24px] bg-black/6" />
              ) : explanationQuery.isError && isApiError(explanationQuery.error) ? (
                <ErrorNotice
                  title="Explanation load failed"
                  message={`${explanationQuery.error.message} Correlation: ${explanationQuery.error.correlationId}.`}
                />
              ) : latestExplanation ? (
                <div className="mt-4 rounded-2xl bg-mist px-4 py-4">
                  <p className="text-sm leading-6 text-ink">{latestExplanation.summary}</p>
                  {Array.isArray(explanationJson?.bullets) ? (
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-steel">
                      {(explanationJson.bullets as unknown[]).map((bullet, index) => (
                        <li key={`${latestExplanation.id}-${index}`}>{String(bullet)}</li>
                      ))}
                    </ul>
                  ) : null}
                  {typeof explanationJson?.caution === "string" ? (
                    <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                      {explanationJson.caution}
                    </p>
                  ) : null}
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-steel">
                    {latestExplanation.provider} | {latestExplanation.modelName} | {latestExplanation.modelVersion}
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                  No explanation has been generated for this decision yet.
                </p>
              )}
            </section>

            <section className={cardClassName}>
              <p className="text-xs uppercase tracking-[0.2em] text-steel">Outcome linkage</p>
              <h5 className="mt-2 text-lg font-semibold text-ink">Latest linked outcome</h5>

              {outcomeQuery.isLoading ? (
                <div className="mt-4 h-24 animate-pulse rounded-[24px] bg-black/6" />
              ) : outcomeQuery.isError && isApiError(outcomeQuery.error) ? (
                <ErrorNotice
                  title="Outcome load failed"
                  message={`${outcomeQuery.error.message} Correlation: ${outcomeQuery.error.correlationId}.`}
                />
              ) : latestOutcome ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl bg-mist px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Outcome status</p>
                      <p className="mt-2 text-lg font-semibold text-ink">{latestOutcome.outcomeStatus}</p>
                    </div>
                    <div className="rounded-2xl bg-mist px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Stockout avoided</p>
                      <p className="mt-2 text-lg font-semibold text-ink">
                        {latestOutcome.stockoutAvoided === null
                          ? "Not available"
                          : latestOutcome.stockoutAvoided
                            ? "Yes"
                            : "No"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-mist px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Computed</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(latestOutcome.computedAt)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Fill-rate delta</p>
                      <p className="mt-2 text-base font-semibold text-ink">
                        {formatNumber(latestOutcome.fillRateDelta)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Inventory days delta</p>
                      <p className="mt-2 text-base font-semibold text-ink">
                        {formatNumber(latestOutcome.inventoryDaysDelta)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Holding cost delta</p>
                      <p className="mt-2 text-base font-semibold text-ink">
                        {formatNumber(latestOutcome.holdingCostDelta)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-steel">Expedite cost delta</p>
                      <p className="mt-2 text-base font-semibold text-ink">
                        {formatNumber(latestOutcome.expediteCostDelta)}
                      </p>
                    </div>
                  </div>

                  <details className="rounded-2xl bg-white px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-ink">Raw outcome summary</summary>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                      {renderJson(latestOutcome.summaryJson)}
                    </pre>
                  </details>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-steel">
                  No linked decision outcome is available yet.
                </p>
              )}
            </section>

            <section className={cardClassName}>
              <p className="text-xs uppercase tracking-[0.2em] text-steel">Raw payloads</p>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <details className="rounded-2xl bg-mist px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Proposed payload</summary>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                    {renderJson(decision.proposedPayload)}
                  </pre>
                </details>
                <details className="rounded-2xl bg-mist px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Rationale</summary>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                    {renderJson(decision.rationale)}
                  </pre>
                </details>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};
