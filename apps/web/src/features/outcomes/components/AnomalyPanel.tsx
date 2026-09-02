import { Link } from "react-router-dom";

import { formatDateTime, formatPercent } from "../../../lib/utils/format";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { EmptyState } from "../../../components/ui/EmptyState";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildInvestigationHref } from "../../investigation/route";
import { formatSeverityLabel, getAnomalySeverityTone } from "../presentation";
import type { AnomalyHighlight } from "../types";

interface AnomalyPanelProps {
  anomalies: AnomalyHighlight[];
}

export const AnomalyPanel = ({ anomalies }: AnomalyPanelProps): JSX.Element => (
  <SectionCard>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="ui-section-label">Anomaly advisory</p>
        <h3 className="mt-1 text-subheading text-ink">Latest anomaly signals</h3>
      </div>
      {anomalies.length > 0 && <StatusChip tone="neutral">{anomalies.length}</StatusChip>}
    </div>

    {anomalies.length > 0 ? (
      <div className="mt-4 space-y-3">
        {anomalies.map((anomaly) => {
          const presentationTone = getAnomalySeverityTone(anomaly.severity);

          let tone: "danger" | "warning" | "info" = "info";
          if (presentationTone.badgeClassName.includes("red")) tone = "danger";
          else if (presentationTone.badgeClassName.includes("amber")) tone = "warning";

          return (
            <article key={anomaly.id} className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{anomaly.scopeLabel}</p>
                  <p className="mt-0.5 text-xs text-steel">
                    Window ending {formatDateTime(anomaly.measurementWindowEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <StatusChip tone={tone}>
                    {formatSeverityLabel(anomaly.severity)}
                  </StatusChip>
                  <p className="mt-1.5 text-sm font-semibold text-ink">
                    Score {formatPercent(anomaly.anomalyScore)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-steel">
                {anomaly.explanationSummary ?? "No explanation summary was persisted for this anomaly score."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {anomaly.skuId && anomaly.locationId ? (
                  <Link
                    to={buildInvestigationHref(anomaly.skuId, anomaly.locationId)}
                    className={`${uiButtonSecondaryClassName} text-xs`}
                  >
                    Open investigation
                  </Link>
                ) : null}
                <Link
                  to={buildDataOpsHref({
                    skuId: anomaly.skuId ?? null,
                    locationId: anomaly.locationId ?? null,
                  })}
                  className={`${uiButtonSecondaryClassName} text-xs`}
                >
                  Trace upstream
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <div className="mt-4">
        <EmptyState
          title="No anomalies"
          message="No anomaly scores are currently persisted for this tenant."
        />
      </div>
    )}
  </SectionCard>
);
