import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableHeaderClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusChip } from "../../../components/ui/StatusChip";
import { buildInvestigationHref } from "../../investigation/route";
import { formatSeverityLabel, getRiskSeverityTone } from "../presentation";
import type { RiskHotspot } from "../types";

interface RiskHotspotsTableProps {
  hotspots: RiskHotspot[];
}

export const RiskHotspotsTable = ({ hotspots }: RiskHotspotsTableProps): JSX.Element => (
  <section className={uiTableShellClassName}>
    <div className={uiTableHeaderClassName}>
      <p className="ui-section-label">Risk queue</p>
      <h3 className="mt-1 text-subheading text-ink">Highest-risk SKU and location scopes</h3>
    </div>

    {hotspots.length > 0 ? (
      <div className={uiTableWrapClassName}>
        <table className={uiTableClassName}>
          <thead className={uiTableHeadClassName}>
            <tr>
              <th>Scope</th>
              <th>Severity</th>
              <th>ATP</th>
              <th>Reorder point</th>
              <th>Safety stock</th>
              <th>Signals</th>
              <th>Freshness</th>
            </tr>
          </thead>
          <tbody>
            {hotspots.slice(0, 10).map((hotspot) => {
              const presentationTone = getRiskSeverityTone(hotspot.severity);

              let tone: "danger" | "warning" | "info" = "info";
              if (presentationTone.badgeClassName.includes("red")) tone = "danger";
              else if (presentationTone.badgeClassName.includes("amber")) tone = "warning";

              return (
                <tr key={hotspot.key} className={uiTableRowClassName}>
                  <td className="px-4 py-3 align-top">
                    <Link
                      to={buildInvestigationHref(hotspot.skuId, hotspot.locationId)}
                      className="font-semibold text-ink underline decoration-slate-300 underline-offset-4 transition hover:text-pine"
                    >
                      {hotspot.scopeLabel}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusChip tone={tone}>
                      {formatSeverityLabel(hotspot.severity)}
                    </StatusChip>
                  </td>
                  <td className="px-4 py-3 align-top text-sm font-semibold tabular-nums text-ink">
                    {formatNumber(hotspot.availableToPromiseQty)}
                  </td>
                  <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                    {formatNumber(hotspot.reorderPointQty)}
                  </td>
                  <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                    {formatNumber(hotspot.safetyStockQty)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ul className="space-y-1 text-sm text-steel">
                      {hotspot.reasons.map((reason) => (
                        <li key={`${hotspot.key}-${reason}`}>{reason}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                    {formatDateTime(hotspot.freshnessAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="p-5">
        <EmptyState
          title="No hotspots"
          message="No high-risk positions are currently surfaced from inventory positions, stockout incidents, or anomaly scores."
        />
      </div>
    )}
  </section>
);
