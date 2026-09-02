import { formatDateTime, formatNumber, formatPercent } from "../../../lib/utils/format";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { formatForecastScopeType } from "../selectors";
import type {
  InvestigationForecastDemandData,
  InvestigationSignalsData,
} from "../types";

interface ForecastDemandSectionProps {
  forecastDemand: InvestigationForecastDemandData;
  signals: InvestigationSignalsData;
}

export const ForecastDemandSection = ({
  forecastDemand,
  signals,
}: ForecastDemandSectionProps): JSX.Element => {
  const latestForecastError = signals.forecastErrors[0] ?? null;

  return (
    <SectionCard>
      <p className="ui-section-label">Demand Forecast</p>
      <h4 className="mt-1 text-subheading text-ink">Forecast and demand context</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-steel">
        Forecast snapshots come from completed forecast jobs. Customer order context is shown only where the exposed read model includes matching lines for this scope.
      </p>

      <div className="mt-6 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Forecast snapshots</h5>
          <div className="space-y-4">
            {forecastDemand.forecastSnapshots.length > 0 ? (
              forecastDemand.forecastSnapshots.map((snapshot) => (
                <div key={snapshot.job.id} className="rounded-radius-lg border border-slate-200/60 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {formatForecastScopeType(snapshot.job.scopeType)} forecast
                      </p>
                      <p className="mt-1 text-xs text-steel">
                        Completed {formatDateTime(snapshot.job.completedAt)} | Horizon {snapshot.job.horizonDays} days
                      </p>
                    </div>
                    <StatusChip tone="neutral">{snapshot.job.modelType}</StatusChip>
                  </div>

                  <div className="mt-5 custom-scrollbar overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-steel">
                          <th className="pb-3 pr-4 font-semibold">Date</th>
                          <th className="pb-3 pr-4 text-right font-semibold">Forecast qty</th>
                          <th className="pb-3 pr-4 text-right font-semibold">Conf low</th>
                          <th className="pb-3 text-right font-semibold">Conf high</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.results.slice(0, 7).map((result) => (
                          <tr key={result.id} className="border-b border-slate-100 text-sm text-ink transition-colors hover:bg-slate-50/50 last:border-0">
                            <td className="py-2.5 pr-4 tabular-nums text-steel">{formatDateTime(result.forecastDate)}</td>
                            <td className="py-2.5 pr-4 text-right font-medium tabular-nums">{formatNumber(result.forecastQty)}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{formatNumber(result.confidenceLow)}</td>
                            <td className="py-2.5 text-right tabular-nums">{formatNumber(result.confidenceHigh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No forecasts"
                message="No completed forecast job results are currently exposed for this SKU/location scope."
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Latest forecast error</h5>
            <div className="rounded-radius-lg border border-slate-200/60 bg-white p-5 shadow-sm">
              <p className="text-3xl font-semibold tracking-tight text-ink">
                {latestForecastError?.percentageError !== null && latestForecastError?.percentageError !== undefined
                  ? formatPercent(latestForecastError.percentageError)
                  : formatNumber(latestForecastError?.absoluteError)}
              </p>
              <p className="mt-2 text-sm text-steel">
                {latestForecastError
                  ? `Window ending ${formatDateTime(latestForecastError.measurementWindowEnd)}`
                  : "No item-level forecast error measurement is persisted yet."}
              </p>
            </div>
          </div>

          <div>
            <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Recent matching orders</h5>
            <div className="space-y-3">
              {forecastDemand.recentOrders.length > 0 ? (
                forecastDemand.recentOrders.map((entry) => (
                  <div key={entry.order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-sm font-medium text-ink">{entry.order.orderNumber}</p>
                      <p className="mt-0.5 text-xs text-steel">
                        Ordered {formatDateTime(entry.order.orderedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{formatNumber(entry.matchedQuantity)} units</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No orders"
                  message="No matching customer orders were found in the currently exposed order list for this scope."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
