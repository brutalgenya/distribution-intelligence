import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import type { MatchedDemandEvidence, SalesImportRun } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusChip } from "../../../components/ui/StatusChip";

interface DemandFreshnessSectionProps {
  salesImportRuns: SalesImportRun[];
  matchedDemandEvidence: MatchedDemandEvidence[];
  hasScopeContext: boolean;
}

export const DemandFreshnessSection = ({
  salesImportRuns,
  matchedDemandEvidence,
  hasScopeContext,
}: DemandFreshnessSectionProps): JSX.Element => {
  const latestImportRun = salesImportRuns[0] ?? null;

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Demand inputs"
        title="Demand and input freshness"
        description="The backend exposes sales import runs and customer orders, but not a dedicated demand-signal read model, so this section uses those persisted records as the closest input evidence."
      />

      <SectionCard>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-8">
           <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
               <DataField
                 label="Latest import"
                 value={<span className="text-lg font-semibold tracking-tight text-ink">{latestImportRun ? formatDateTime(latestImportRun.completedAt ?? latestImportRun.startedAt) : "Not available"}</span>}
               />
           </div>
            <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
               <DataField
                 label="Import status"
                 value={<span className="text-lg font-semibold tracking-tight text-ink">{latestImportRun?.status ?? "Not available"}</span>}
               />
           </div>
            <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
               <DataField
                 label="Accepted rows"
                 value={<span className="text-lg font-semibold tracking-tight text-ink">{formatNumber(latestImportRun?.acceptedRows)}</span>}
               />
           </div>
            <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
               <DataField
                 label="Matched orders"
                 value={<span className="text-lg font-semibold tracking-tight text-ink">{hasScopeContext ? formatNumber(matchedDemandEvidence.length) : "Context required"}</span>}
               />
           </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-radius-md border border-slate-100 bg-white p-5 shadow-sm">
            <h4 className="ui-section-label mb-4">Recent sales imports</h4>
            <div className="space-y-3">
              {salesImportRuns.length > 0 ? (
                salesImportRuns.slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink font-mono">{run.id}</p>
                        <p className="mt-1 text-sm text-steel">
                          Started <span className="font-medium text-ink">{formatDateTime(run.startedAt)}</span> <span className="mx-1.5 opacity-40">·</span> Completed <span className="font-medium text-ink">{formatDateTime(run.completedAt)}</span>
                        </p>
                      </div>
                      <StatusChip tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "neutral"}>
                        {run.status}
                      </StatusChip>
                    </div>
                  </div>
                ))
              ) : (
                  <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                     <EmptyState title="No sales imports" message="No sales import runs are currently persisted." />
                  </div>
              )}
            </div>
          </div>

          <div className="rounded-radius-md border border-slate-100 bg-white p-5 shadow-sm">
            <h4 className="ui-section-label mb-4">Matching order evidence</h4>
            <div className="space-y-3">
              {hasScopeContext ? (
                matchedDemandEvidence.length > 0 ? (
                  matchedDemandEvidence.map((entry) => (
                    <div key={entry.order.id} className="rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink font-mono">{entry.order.orderNumber}</p>
                          <p className="mt-1 text-sm text-steel">
                            Ordered <span className="font-medium text-ink">{formatDateTime(entry.order.orderedAt)}</span>
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-ink">
                          {formatNumber(entry.matchedQuantity)} units
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                   <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                       <EmptyState title="No matching orders" message="No matching customer orders were found in the currently exposed order read model for this SKU/location." />
                   </div>
                )
              ) : (
                  <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                      <EmptyState title="Scope context required" message="Add `skuId` and `locationId` query params to inspect order evidence for a specific investigation scope." />
                  </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </section>
  );
};
