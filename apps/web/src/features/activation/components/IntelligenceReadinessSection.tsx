import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildDataOpsHref } from "../../data-ops/route";
import type { IntelligenceReadiness } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";

interface IntelligenceReadinessSectionProps {
  intelligence: IntelligenceReadiness;
  latestForecastResultsCount: number;
}

export const IntelligenceReadinessSection = ({
  intelligence,
  latestForecastResultsCount,
}: IntelligenceReadinessSectionProps): JSX.Element => {
  const latestCompletedForecastJob =
    intelligence.forecastJobs
      .filter((forecastJob) => forecastJob.status === "completed")
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.createdAt).getTime() -
          new Date(left.completedAt ?? left.createdAt).getTime(),
      )[0] ?? null;
  const latestDecision =
    intelligence.decisions
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ??
    null;
  const latestExecution =
    intelligence.executions
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ??
    null;
  const latestApproval =
    intelligence.approvals
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ??
    null;

  return (
    <section className="space-y-4">
      <PageHeader
      label="Decision readiness"
        title="Intelligence readiness"
        description="Confirm the first forecast, decision, and workflow milestones from the real backend records rather than from inferred lifecycle assumptions."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <SectionCard>
          <div className="flex flex-col">
            <div className="flex-1">
              <p className="ui-section-label">Forecast milestone</p>
              <h4 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                {latestCompletedForecastJob && latestForecastResultsCount > 0 ? "Observed" : "Not yet observed"}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-steel">
                {latestCompletedForecastJob
                  ? <>Latest completed job <span className="font-mono text-xs">{latestCompletedForecastJob.id}</span> with <span className="font-medium text-ink">{formatNumber(latestForecastResultsCount)}</span> result row(s).</>
                  : "No completed forecast job is currently persisted."}
              </p>
            </div>
            <Link
              to={buildDataOpsHref(
                latestCompletedForecastJob ? { forecastJobId: latestCompletedForecastJob.id } : {},
              )}
              className={`mt-6 self-start ${uiButtonSecondaryClassName}`}
            >
              Open data & forecast ops
            </Link>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex flex-col">
            <div className="flex-1">
              <p className="ui-section-label">Decision milestone</p>
               <h4 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                {latestDecision ? "Observed" : "Not yet observed"}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-steel">
                {latestDecision
                  ? <>Latest decision is <StatusChip tone="neutral">{latestDecision.status}</StatusChip> from {formatDateTime(latestDecision.createdAt)}.</>
                  : "No decision record is currently persisted."}
              </p>
            </div>
            <Link
              to="/decisions"
              className={`mt-6 self-start ${uiButtonSecondaryClassName}`}
            >
              Open decision inbox
            </Link>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex flex-col">
             <div className="flex-1">
              <p className="ui-section-label">Workflow milestone</p>
              <h4 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                {latestExecution || latestApproval ? "Observed" : "Not yet observed"}
              </h4>
               <p className="mt-3 text-sm leading-relaxed text-steel">
                {latestExecution
                  ? <>Latest execution is <StatusChip tone="neutral">{latestExecution.status}</StatusChip> from {formatDateTime(latestExecution.createdAt)}.</>
                  : latestApproval
                    ? <>Latest approval is <StatusChip tone="neutral">{latestApproval.status}</StatusChip> from {formatDateTime(latestApproval.createdAt)}.</>
                    : "No approval or execution record is currently persisted."}
              </p>
            </div>
            <Link
              to="/workflow"
              className={`mt-6 self-start ${uiButtonSecondaryClassName}`}
            >
              Open workflow operations
            </Link>
          </div>
        </SectionCard>
      </div>
    </section>
  );
};
