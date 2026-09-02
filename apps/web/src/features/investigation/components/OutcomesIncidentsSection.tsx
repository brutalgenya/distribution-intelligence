import { formatDateTime, formatNumber, formatPercent } from "../../../lib/utils/format";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SectionCard } from "../../../components/ui/SectionCard";
import { formatSeverityLabel } from "../../outcomes/presentation";
import type {
  InvestigationDecisionData,
  InvestigationSignalsData,
} from "../types";

interface OutcomesIncidentsSectionProps {
  signals: InvestigationSignalsData;
  decisionData: InvestigationDecisionData;
}

export const OutcomesIncidentsSection = ({
  signals,
  decisionData,
}: OutcomesIncidentsSectionProps): JSX.Element => {
  const latestFillRate = signals.fillRates[0] ?? null;
  const latestForecastError = signals.forecastErrors[0] ?? null;
  const latestOutcome = decisionData.decisions.flatMap((bundle) => bundle.outcomes)[0] ?? null;

  return (
    <SectionCard className="h-full">
      <p className="ui-section-label">Contextual Alerts</p>
      <h4 className="mt-1 text-subheading text-ink">Incidents, anomalies, and measured outcomes</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-steel">
        Evidence of what happened after the item entered risk, decision, and execution flows.
      </p>

      <div className="mt-6 grid gap-4 grid-cols-2">
        <DataField label="Open incidents" value={formatNumber(signals.stockouts.filter((incident) => incident.incidentEndAt === null).length)} />
        <DataField label="Latest fill rate" value={formatPercent(latestFillRate?.fillRate)} />
        <DataField
          label="Forecast error"
          value={
            latestForecastError?.percentageError !== null && latestForecastError?.percentageError !== undefined
              ? formatPercent(latestForecastError.percentageError)
              : formatNumber(latestForecastError?.absoluteError)
          }
        />
        <DataField label="Latest outcome" value={latestOutcome ? latestOutcome.outcomeStatus : "Not available"} />
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Stockout incidents</h5>
          <div className="space-y-3">
            {signals.stockouts.length > 0 ? (
              signals.stockouts.map((incident) => (
                <div key={incident.id} className="rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {incident.severity ? formatSeverityLabel(incident.severity) : "Unscored"} incident
                      </p>
                      <p className="mt-0.5 text-xs text-steel">Started {formatDateTime(incident.incidentStartAt)}</p>
                    </div>
                    <p className="text-sm font-medium text-steel">
                      {incident.incidentEndAt ? `Ended ${formatDateTime(incident.incidentEndAt)}` : "Still open"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No incidents" message="No stockout incident is currently persisted for this scope." />
            )}
          </div>
        </div>

        <div>
          <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Anomalies and impact</h5>
          <div className="space-y-3">
            {signals.anomalies.length > 0 ? (
              signals.anomalies.map((anomaly) => (
                <div key={anomaly.id} className="rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{formatSeverityLabel(anomaly.severity)} anomaly</p>
                      <p className="mt-0.5 text-xs text-steel">
                        Score {formatPercent(anomaly.anomalyScore)} | Window end {formatDateTime(anomaly.measurementWindowEnd)}
                      </p>
                    </div>
                  </div>
                  {anomaly.explanationSummary ? (
                    <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-steel">{anomaly.explanationSummary}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="No anomalies" message="No anomaly advisory is currently persisted for this scope." />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
