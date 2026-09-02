import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { SectionCard } from "../../../components/ui/SectionCard";
import {
  formatDecisionStatus,
  formatDecisionType,
  summarizeDecision,
} from "../../decisions/presentation";
import {
  formatExecutionStatus,
  formatExecutionTaskType,
} from "../../workflow/presentation";
import type { InvestigationDecisionData } from "../types";

interface DecisionWorkflowSectionProps {
  decisionData: InvestigationDecisionData;
}

export const DecisionWorkflowSection = ({
  decisionData,
}: DecisionWorkflowSectionProps): JSX.Element => (
  <SectionCard>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="ui-section-label">Automation Ledger</p>
        <h4 className="mt-1 text-subheading text-ink">Decisions, executions, and measured follow-through</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-steel">
          Related decision records for this exact SKU/location scope, plus any linked execution tasks the support API exposes by decision id.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/decisions" className={`${uiButtonSecondaryClassName} text-xs`}>
          Open decisions
        </Link>
        <Link to="/workflow" className={`${uiButtonSecondaryClassName} text-xs`}>
          Open workflow
        </Link>
      </div>
    </div>

    <div className="mt-6 space-y-6">
      {decisionData.decisions.length > 0 ? (
        decisionData.decisions.map((bundle) => (
          <div key={bundle.decision.id} className="rounded-radius-lg border border-slate-200/60 bg-slate-50/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="info">{formatDecisionType(bundle.decision.decisionType)}</StatusChip>
                  <StatusChip tone="neutral">{formatDecisionStatus(bundle.decision.status)}</StatusChip>
                </div>
                <h5 className="mt-3 text-lg font-semibold text-ink">{summarizeDecision(bundle.decision)}</h5>
                <p className="mt-1 text-xs text-steel">Decision {bundle.decision.id}</p>
              </div>
              <div className="text-right text-xs text-steel">
                <p>Updated {formatDateTime(bundle.decision.updatedAt)}</p>
                <p className="mt-1 font-medium text-ink">Confidence {formatNumber(bundle.decision.confidenceScore)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-radius-md border border-slate-200/60 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink">Execution history</p>
                <div className="mt-4 space-y-3">
                  {bundle.executions.length > 0 ? (
                    bundle.executions.map((execution) => (
                      <div key={execution.id} className="rounded-radius-md border border-slate-100 bg-slate-50/80 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-ink">{formatExecutionTaskType(execution.taskType)}</p>
                            <p className="mt-0.5 text-xs text-steel">{execution.id}</p>
                          </div>
                          <StatusChip tone="neutral">{formatExecutionStatus(execution.status)}</StatusChip>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No executions" message="No linked execution task is currently exposed for this decision." />
                  )}
                </div>
              </div>

              <div className="rounded-radius-md border border-slate-200/60 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink">Measured outcomes</p>
                <div className="mt-4 space-y-3">
                  {bundle.outcomes.length > 0 ? (
                    bundle.outcomes.map((outcome) => (
                      <div key={outcome.id} className="rounded-radius-md border border-slate-100 bg-slate-50/80 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-ink">{outcome.outcomeStatus}</p>
                            <p className="mt-0.5 text-xs text-steel">
                              Window end {formatDateTime(outcome.measurementWindowEnd)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-ink">
                            {outcome.stockoutAvoided === null
                              ? "No stockout verdict"
                              : outcome.stockoutAvoided
                                ? "Stockout avoided"
                                : "Stockout not avoided"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No outcomes" message="No measured decision outcomes are currently linked to this decision." />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState title="No decisions" message="No persisted decisions are currently scoped to this SKU/location pair." />
      )}
    </div>
  </SectionCard>
);
