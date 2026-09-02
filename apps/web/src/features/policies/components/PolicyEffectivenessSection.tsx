import { Link } from "react-router-dom";

import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import { formatDateTime, formatNumber, formatPercent } from "../../../lib/utils/format";
import { buildPoliciesHref } from "../route";
import { derivePolicyEffectivenessCards } from "../selectors";
import type { Policy, PolicyEffectivenessSummary } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";

interface PolicyEffectivenessSectionProps {
  selectedPolicy: Policy | null;
  summaries: PolicyEffectivenessSummary[];
}

export const PolicyEffectivenessSection = ({
  selectedPolicy,
  summaries,
}: PolicyEffectivenessSectionProps): JSX.Element => {
  const cards = derivePolicyEffectivenessCards(summaries);

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
       <PageHeader
      label="Measured impact"
          title="Policy effectiveness"
          description="Use policy-level outcome summaries that the backend already computes. This section does not invent effectiveness formulas beyond those persisted metrics."
        >
          <div className="flex flex-wrap gap-3">
            <Link to="/outcomes" className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
              Open outcomes
            </Link>
            <Link to="/workflow" className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
              Open workflow
            </Link>
          </div>
        </PageHeader>

      {cards.length > 0 ? <MetricCardGrid items={cards} /> : null}

      {summaries.length > 0 ? (
        <div className="rounded-radius-lg border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
             <p className="ui-section-label mb-1">
              {selectedPolicy ? "Selected policy evidence" : "Policy evidence"}
            </p>
            <h4 className="text-xl font-semibold tracking-tight text-ink">
              {selectedPolicy ? `${selectedPolicy.name} summaries` : "Latest policy summaries"}
            </h4>
          </div>

          <div className="custom-scrollbar overflow-x-auto">
             <table className="min-w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-xs uppercase tracking-wider text-steel">
                  <tr>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Policy</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Window end</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Decision count</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Executed</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Stockout avoidance</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Fill-rate delta</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Forecast error</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Override rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaries.slice(0, 8).map((summary) => (
                    <tr key={summary.id} className="transition-colors duration-200 hover:bg-slate-50">
                      <td className="px-5 py-4 align-top">
                        <Link
                          to={buildPoliciesHref({ policyId: summary.policyId })}
                          className="font-semibold text-ink underline-offset-4 transition hover:underline whitespace-nowrap block"
                        >
                          {summary.policyId}
                        </Link>
                        <p className="mt-1 text-sm font-medium text-steel">v{summary.policyVersion}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                        {formatDateTime(summary.measurementWindowEnd)}
                      </td>
                      <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">
                        {formatNumber(summary.decisionCount)}
                      </td>
                      <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">
                        {formatNumber(summary.executedDecisionCount)}
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                        {formatPercent(summary.stockoutAvoidanceRate)}
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                        {summary.averageFillRateDelta === null ? "Not available" : formatPercent(summary.averageFillRateDelta)}
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                        {formatNumber(summary.averageForecastError)}
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                        {formatPercent(summary.overrideRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      ) : (
         <div className="bg-white rounded-radius-lg p-8 border border-slate-200/60 shadow-sm flex items-center justify-center">
             <EmptyState title="No effectiveness data" message="No policy effectiveness summaries are currently exposed for this scope. The governance workspace stays read-only until the outcomes layer persists policy-level evidence." />
        </div>
      )}
    </section>
  );
};
