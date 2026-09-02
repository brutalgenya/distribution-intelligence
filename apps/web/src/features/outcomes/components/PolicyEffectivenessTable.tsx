import { Link } from "react-router-dom";

import { formatDateTime, formatNumber, formatPercent } from "../../../lib/utils/format";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableHeaderClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";
import { buildPoliciesHref } from "../../policies/route";
import { formatCompactId } from "../presentation";
import type { PolicyEffectivenessSummary } from "../types";

interface PolicyEffectivenessTableProps {
  summaries: PolicyEffectivenessSummary[];
}

export const PolicyEffectivenessTable = ({
  summaries,
}: PolicyEffectivenessTableProps): JSX.Element => (
  <section className={uiTableShellClassName}>
    <div className={uiTableHeaderClassName}>
      <p className="ui-section-label">Policy effectiveness</p>
      <h3 className="mt-1 text-subheading text-ink">Latest policy outcome summaries</h3>
    </div>

    {summaries.length > 0 ? (
      <div className={uiTableWrapClassName}>
        <table className={uiTableClassName}>
          <thead className={uiTableHeadClassName}>
            <tr>
              <th>Policy</th>
              <th>Window end</th>
              <th>Decision count</th>
              <th>Executed</th>
              <th>Stockout avoidance</th>
              <th>Fill-rate delta</th>
              <th>Forecast error</th>
              <th>Override rate</th>
            </tr>
          </thead>
          <tbody>
            {summaries.slice(0, 8).map((summary) => (
              <tr key={summary.id} className={uiTableRowClassName}>
                <td className="px-4 py-3 align-top">
                  <Link
                    to={buildPoliciesHref({ policyId: summary.policyId })}
                    className="font-semibold text-ink underline decoration-slate-300 underline-offset-4 transition hover:text-pine hover:decoration-pine/50"
                  >
                    {formatCompactId(summary.policyId)}
                  </Link>
                  <p className="mt-0.5 text-xs text-steel">v{summary.policyVersion}</p>
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {formatDateTime(summary.measurementWindowEnd)}
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {formatNumber(summary.decisionCount)}
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {formatNumber(summary.executedDecisionCount)}
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {formatPercent(summary.stockoutAvoidanceRate)}
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {summary.averageFillRateDelta === null ? "Not available" : formatPercent(summary.averageFillRateDelta)}
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {formatNumber(summary.averageForecastError)}
                </td>
                <td className="px-4 py-3 align-top text-sm tabular-nums text-ink">
                  {formatPercent(summary.overrideRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="p-5">
        <EmptyState
          title="No summary available"
          message="No policy effectiveness summaries are currently available."
        />
      </div>
    )}
  </section>
);
