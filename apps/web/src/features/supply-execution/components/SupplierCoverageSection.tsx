import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  buildLeadTimeSummary,
  formatSupplierStatus,
} from "../selectors";
import type {
  Supplier,
  SupplierCoverageRow,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
  SupplierSku,
} from "../types";
import { PartialDataNotice } from "./SupplyExecutionStates";

interface SupplierCoverageSectionProps {
  focusedSupplier: Supplier | null;
  focusedSupplierPerformance: SupplierPerformanceSnapshot | null;
  focusedSupplierLeadTimes: SupplierLeadTimeStat[];
  focusedMappings: SupplierSku[];
  supplierCoverageRows: SupplierCoverageRow[];
}

const cardClassName = "rounded-[28px] border border-black/8 bg-white p-5 shadow-panel";

export const SupplierCoverageSection = ({
  focusedSupplier,
  focusedSupplierPerformance,
  focusedSupplierLeadTimes,
  focusedMappings,
  supplierCoverageRows,
}: SupplierCoverageSectionProps): JSX.Element => {
  const leadTimeSummary = buildLeadTimeSummary(focusedSupplierLeadTimes);

  return (
    <section className={cardClassName}>
      <p className="text-xs uppercase tracking-[0.2em] text-steel">Supplier coverage</p>
      <h4 className="mt-2 text-xl font-semibold text-ink">Supplier coverage and lead-time context</h4>
      <p className="mt-2 text-sm leading-6 text-steel">
        Inspect supplier-side constraints, lead-time evidence, and supplier-SKU coverage for the selected PO or
        investigation scope.
      </p>

      {focusedSupplier ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr] 2xl:grid-cols-1">
            <div className="rounded-[24px] bg-mist px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-steel">Focused supplier</p>
              <h5 className="mt-2 text-xl font-semibold text-ink">
                {focusedSupplier.code} - {focusedSupplier.name}
              </h5>
              <p className="mt-2 text-sm leading-6 text-steel">
                Status {formatSupplierStatus(focusedSupplier.status)} | Contact {focusedSupplier.contactEmail ?? "Not available"}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Total purchase orders</p>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {formatNumber(focusedSupplierPerformance?.totalPurchaseOrders ?? null)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Delayed purchase orders</p>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {formatNumber(focusedSupplierPerformance?.delayedPurchaseOrders ?? null)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Average lead time</p>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {formatNumber(focusedSupplierPerformance?.averageLeadTimeDays ?? null)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Last receipt</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatDateTime(focusedSupplierPerformance?.lastReceiptAt ?? null)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-mist px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-steel">Lead-time context</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Average</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{leadTimeSummary.average}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Latest observation</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{leadTimeSummary.latest}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-steel">Samples</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{leadTimeSummary.sampleCount}</p>
                </div>
              </div>

              {focusedSupplierLeadTimes.length > 0 ? (
                <div className="mt-4 custom-scrollbar overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.16em] text-steel">
                        <th className="px-3 py-3 font-semibold">SKU</th>
                        <th className="px-3 py-3 font-semibold">Average</th>
                        <th className="px-3 py-3 font-semibold">Range</th>
                        <th className="px-3 py-3 font-semibold">Last observed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {focusedSupplierLeadTimes.slice(0, 8).map((stat) => (
                        <tr key={stat.id} className="border-t border-black/6 bg-white">
                          <td className="px-3 py-3 text-sm text-ink">{stat.skuId}</td>
                          <td className="px-3 py-3 text-sm text-ink">{formatNumber(stat.averageLeadTimeDays)}</td>
                          <td className="px-3 py-3 text-sm text-ink">
                            {formatNumber(stat.minLeadTimeDays)} - {formatNumber(stat.maxLeadTimeDays)}
                          </td>
                          <td className="px-3 py-3 text-sm text-ink">{formatDateTime(stat.lastObservedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4">
                  <PartialDataNotice
                    title="No lead-time samples exposed"
                    message="The backend does not currently expose lead-time observations for this supplier in the active tenant scope."
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] bg-mist px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-steel">Supplier-SKU coverage</p>
            {focusedMappings.length > 0 ? (
              <div className="mt-4 custom-scrollbar overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-steel">
                      <th className="px-3 py-3 font-semibold">SKU</th>
                      <th className="px-3 py-3 font-semibold">Supplier SKU</th>
                      <th className="px-3 py-3 font-semibold">Primary</th>
                      <th className="px-3 py-3 font-semibold">MOQ</th>
                      <th className="px-3 py-3 font-semibold">Configured lead time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {focusedMappings.slice(0, 10).map((mapping) => (
                      <tr key={mapping.id} className="border-t border-black/6 bg-white">
                        <td className="px-3 py-3 text-sm text-ink">{mapping.skuId}</td>
                        <td className="px-3 py-3 text-sm text-ink">{mapping.supplierSkuCode ?? "Not available"}</td>
                        <td className="px-3 py-3 text-sm text-ink">{mapping.isPrimary ? "Yes" : "No"}</td>
                        <td className="px-3 py-3 text-sm text-ink">{formatNumber(mapping.minOrderQty)}</td>
                        <td className="px-3 py-3 text-sm text-ink">{formatNumber(mapping.leadTimeDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4">
                <PartialDataNotice
                  title="Supplier-SKU coverage is not exposed for this focus"
                  message="The current backend route surface does not expose any supplier-SKU mappings for the focused supplier or current investigation item."
                />
              </div>
            )}
          </div>
        </div>
      ) : supplierCoverageRows.length > 0 ? (
        <div className="mt-5">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-steel">
                  <th className="px-3 py-3 font-semibold">Supplier</th>
                  <th className="px-3 py-3 font-semibold">Open POs</th>
                  <th className="px-3 py-3 font-semibold">Delayed</th>
                  <th className="px-3 py-3 font-semibold">Partially received</th>
                  <th className="px-3 py-3 font-semibold">Open quantity</th>
                </tr>
              </thead>
              <tbody>
                {supplierCoverageRows.map((row) => (
                  <tr key={row.supplier.id} className="border-t border-black/6 bg-white">
                    <td className="px-3 py-3 text-sm text-ink">
                      {row.supplier.code} - {row.supplier.name}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink">{formatNumber(row.openPurchaseOrderCount)}</td>
                    <td className="px-3 py-3 text-sm text-ink">{formatNumber(row.delayedPurchaseOrderCount)}</td>
                    <td className="px-3 py-3 text-sm text-ink">{formatNumber(row.partiallyReceivedCount)}</td>
                    <td className="px-3 py-3 text-sm text-ink">{formatNumber(row.openQuantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <PartialDataNotice
              title="Choose a supplier or purchase order for deeper context"
              message="Lead-time stats and supplier performance snapshots are exposed per supplier, so this section becomes more detailed when a supplier is focused through the queue or route params."
            />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <PartialDataNotice
            title="Supplier risk is not available yet"
            message="No supplier with open or delayed purchase orders is currently visible in the loaded queue."
          />
        </div>
      )}
    </section>
  );
};
