import { Link } from "react-router-dom";

import { formatDateTime, formatPercent } from "../../../lib/utils/format";
import { formatSeverityLabel } from "../../outcomes/presentation";
import { buildInvestigationHref } from "../../investigation/route";
import { buildDataOpsHref } from "../route";
import { formatAiRunType, parseSubjectScope } from "../selectors";
import type { AiRun, AnomalyScore } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";

interface AnomalySignalsSectionProps {
  anomalies: AnomalyScore[];
  aiRuns: AiRun[];
}

export const AnomalySignalsSection = ({
  anomalies,
  aiRuns,
}: AnomalySignalsSectionProps): JSX.Element => (
  <section className="space-y-4 w-full flex flex-col items-stretch">
    <PageHeader
      label="Anomaly signals"
      title="Anomalies and AI signals"
      description="Advisory anomaly records and recent AI runs that can help explain suspicious forecast or upstream data behavior."
    />

    <SectionCard>
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
          <h4 className="ui-section-label mb-4">Anomaly records</h4>
          <div className="space-y-3">
            {anomalies.length > 0 ? (
              anomalies.slice(0, 8).map((anomaly) => {
                const scope = parseSubjectScope(anomaly);

                let anomalyTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                if(anomaly.anomalyScore >= 80) anomalyTone = "danger";
                else if(anomaly.anomalyScore >= 50) anomalyTone = "warning";

                return (
                  <article key={anomaly.id} className="rounded-radius-md border border-slate-200/60 bg-white shadow-sm p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                         <StatusChip tone={anomalyTone}>
                           {formatSeverityLabel(anomaly.severity)} anomaly
                         </StatusChip>
                        <p className="mt-2 text-sm text-steel">
                          <span className="font-semibold text-ink">{anomaly.subjectType}</span> <span className="mx-1.5 opacity-40">·</span> Updated <span className="font-medium text-ink">{formatDateTime(anomaly.updatedAt)}</span>
                        </p>
                      </div>
                      <p className="text-xl font-bold tracking-tight text-ink">
                        {formatPercent(anomaly.anomalyScore)}
                      </p>
                    </div>

                    <div className="mt-4 rounded-radius-md bg-slate-50 border border-slate-100 p-3">
                      <p className="text-sm leading-relaxed text-steel">
                        {anomaly.explanationSummary ?? "No explanation summary was persisted for this anomaly."}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {scope.skuId && scope.locationId ? (
                        <Link
                          to={buildInvestigationHref(scope.skuId, scope.locationId)}
                          className={uiButtonSecondaryClassName}
                        >
                          Open investigation
                        </Link>
                      ) : null}
                      <Link
                        to={buildDataOpsHref({
                          skuId: scope.skuId,
                          locationId: scope.locationId,
                        })}
                        className={uiButtonSecondaryClassName}
                      >
                        Trace upstream
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
                <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                   <EmptyState title="No anomalies" message="No anomaly scores are currently exposed for this scope." />
                </div>
            )}
          </div>
        </div>

        <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
          <h4 className="ui-section-label mb-4">Recent AI runs</h4>
          <div className="space-y-3">
            {aiRuns.length > 0 ? (
              aiRuns.slice(0, 8).map((run) => {
                 let runTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                 if(run.status === "succeeded") runTone = "success";
                 else if(run.status === "failed") runTone = "danger";
                 else runTone = "warning";

                return (
                <div key={run.id} className="rounded-radius-md border border-slate-200/60 bg-white shadow-sm p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{formatAiRunType(run.runType)}</p>
                      <p className="mt-1 text-sm text-steel">
                        {run.modelName} <span className="mx-1.5 opacity-40">·</span> {run.modelVersion}
                      </p>
                    </div>
                    <StatusChip tone={runTone}>
                      {run.status}
                    </StatusChip>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wider text-steel mb-1">Timing</p>
                  <p className="text-sm text-steel">
                    Created <span className="font-medium text-ink">{formatDateTime(run.createdAt)}</span> <span className="mx-1.5 opacity-40">·</span> Completed <span className="font-medium text-ink">{formatDateTime(run.completedAt)}</span>
                  </p>

                  <div className="mt-4 rounded-radius-md bg-slate-50 border border-slate-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-steel mb-1">Subject Result</p>
                    <p className="text-sm leading-relaxed text-ink break-all">
                      {run.errorMessage ?? `Subject ${run.subjectType}: ${run.subjectReference}`}
                    </p>
                  </div>
                </div>
              )})
            ) : (
               <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                   <EmptyState title="No AI runs" message="No AI run history is currently exposed through the support read model." />
               </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  </section>
);
