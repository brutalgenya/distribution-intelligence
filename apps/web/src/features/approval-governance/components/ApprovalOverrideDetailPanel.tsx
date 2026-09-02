import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildPoliciesHref } from "../../policies/route";
import { formatAutomationTier, formatDecisionStatus, formatDecisionType } from "../../decisions/presentation";
import {
  formatApprovalStatus,
  formatOverrideType,
  getApprovalStatusTone,
  getAuditMetadataLabel,
  getDecisionSummary,
  getInterventionDetailSummary,
  getOverrideTone,
} from "../selectors";
import type {
  ApprovalRow,
  Decision,
  DecisionOutcome,
  GovernanceAuditItem,
  OverrideRow,
  Policy,
  SupportExecutionTask,
} from "../types";

interface ApprovalOverrideDetailPanelProps {
  approval: ApprovalRow | null;
  decision: Decision | null;
  policy: Policy | null;
  relatedExecutions: SupportExecutionTask[];
  relatedOverrides: OverrideRow[];
  latestOutcome: DecisionOutcome | null;
  auditItems: GovernanceAuditItem[];
  isActionPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const cardClassName = "rounded-[24px] border border-black/8 bg-white p-5 shadow-panel";
const linkClassName =
  "inline-flex rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5";

export const ApprovalOverrideDetailPanel = ({
  approval,
  decision,
  policy,
  relatedExecutions,
  relatedOverrides,
  latestOutcome,
  auditItems,
  isActionPending,
  onApprove,
  onReject,
}: ApprovalOverrideDetailPanelProps): JSX.Element => {
  const approvalTone = approval ? getApprovalStatusTone(approval.status) : null;

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between 2xl:flex-col 2xl:items-start">
          <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Selected decision</p>
            <h3 className="mt-2 text-3xl font-semibold text-ink">Approval and override detail</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
              {getInterventionDetailSummary({
                approval,
                decision,
                policy,
                overrides: relatedOverrides,
                latestOutcome,
              })}
            </p>
          </div>

          {approval ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onApprove}
                disabled={approval.status !== "pending" || isActionPending}
                className="rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pine/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActionPending ? "Working..." : "Approve"}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={approval.status !== "pending" || isActionPending}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActionPending ? "Working..." : "Reject"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr] 2xl:grid-cols-1">
        <section className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Approval metadata</p>
          {approval ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{approval.purpose}</p>
                  <p className="mt-1 text-sm text-steel">{approval.id}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${approvalTone?.badgeClassName ?? ""}`}>
                  {formatApprovalStatus(approval.status)}
                </span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Requested by</dt>
                  <dd className="mt-2 break-all text-sm font-semibold text-ink">
                    {approval.requestedByUserId ?? "System-managed"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Assigned to</dt>
                  <dd className="mt-2 break-all text-sm font-semibold text-ink">
                    {approval.assignedToUserId ?? "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Requested</dt>
                  <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(approval.requestedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Decided</dt>
                  <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(approval.decidedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Decided by</dt>
                  <dd className="mt-2 break-all text-sm font-semibold text-ink">
                    {approval.decidedByUserId ?? "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-steel">Observed wait</dt>
                  <dd className="mt-2 text-sm font-semibold text-ink">{approval.waitLabel}</dd>
                </div>
              </dl>

              <div className="rounded-2xl bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Comment</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  {approval.comment ?? "No approval comment was persisted."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
              No specific approval task is selected. This can happen when you deep-link a decision or policy into the workspace without choosing a single approval row.
            </div>
          )}
        </section>

        <section className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Decision and policy context</p>
          {decision ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-ink">{getDecisionSummary(decision)}</p>
                <p className="mt-2 text-sm text-steel">{decision.id}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-mist px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Decision type</p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {formatDecisionType(decision.decisionType)}
                  </p>
                </div>
                <div className="rounded-2xl bg-mist px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Decision status</p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {formatDecisionStatus(decision.status)}
                  </p>
                </div>
                <div className="rounded-2xl bg-mist px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Automation tier</p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {formatAutomationTier(decision.automationTier)}
                  </p>
                </div>
                <div className="rounded-2xl bg-mist px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Linked policy</p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {policy ? `${policy.name} v${policy.version}` : `${decision.policyId} v${decision.policyVersion}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to={`/decisions?decisionId=${decision.id}`} className={linkClassName}>
                  Open decision inbox
                </Link>
                <Link to={buildPoliciesHref({ policyId: decision.policyId })} className={linkClassName}>
                  Open policy governance
                </Link>
                <Link to="/workflow" className={linkClassName}>
                  Open workflow
                </Link>
                <Link to="/outcomes" className={linkClassName}>
                  Open outcomes
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
              No linked decision detail is available for the current selection.
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr] 2xl:grid-cols-1">
        <section className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Manual intervention evidence</p>
          {relatedOverrides.length > 0 ? (
            <div className="mt-4 space-y-3">
              {relatedOverrides.slice(0, 6).map((override) => {
                const tone = getOverrideTone(override.overrideType);

                return (
                  <div key={override.id} className="rounded-2xl bg-mist px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badgeClassName}`}>
                        {formatOverrideType(override.overrideType)}
                      </span>
                      <p className="text-sm text-steel">{formatDateTime(override.createdAt)}</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-ink">{override.reason}</p>
                    <p className="mt-2 text-sm text-steel">
                      Created by {override.createdByUserId} {override.executionTaskId ? `| Execution ${override.executionTaskId}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
              No direct operator override records are linked to this decision or its known execution tasks.
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-steel">Related executions</p>
            <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(relatedExecutions.length)}</p>
            <p className="mt-2 text-sm text-steel">
              Execution-linked overrides are only visible when the backend has persisted an `executionTaskId` on the override record.
            </p>
          </div>
        </section>

        <section className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Outcome and audit evidence</p>

          {latestOutcome ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Outcome status</p>
                <p className="mt-2 text-base font-semibold text-ink">{latestOutcome.outcomeStatus}</p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Computed</p>
                <p className="mt-2 text-base font-semibold text-ink">{formatDateTime(latestOutcome.computedAt)}</p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Fill-rate delta</p>
                <p className="mt-2 text-base font-semibold text-ink">{formatNumber(latestOutcome.fillRateDelta)}</p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Expedite cost delta</p>
                <p className="mt-2 text-base font-semibold text-ink">{formatNumber(latestOutcome.expediteCostDelta)}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
              No linked decision outcome is available for the current decision scope.
            </div>
          )}

          {auditItems.length > 0 ? (
            <div className="mt-4 space-y-3">
              {auditItems.slice(0, 5).map((item) => (
                <details key={item.id} className="rounded-2xl bg-white px-4 py-4">
                  <summary className="cursor-pointer list-none">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-steel">{getAuditMetadataLabel(item)}</p>
                  </summary>
                  <p className="mt-4 text-sm leading-6 text-steel">{item.description}</p>
                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
                    {item.metadataPreview}
                  </pre>
                </details>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
              No governance-specific audit timeline entries are available for this selection.
            </div>
          )}
        </section>
      </div>
    </section>
  );
};
