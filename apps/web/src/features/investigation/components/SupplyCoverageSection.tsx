import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { SectionCard } from "../../../components/ui/SectionCard";
import { buildBuyerActionsHref } from "../../buyer-actions/route";
import { buildSupplyExecutionHref } from "../../supply-execution/route";
import {
  buildLeadTimeLookup,
  buildSupplierLookup,
  formatPurchaseOrderStatus,
  summarizeSupplyCoverage,
} from "../selectors";
import type { InvestigationParams, InvestigationSupplyData } from "../types";

interface SupplyCoverageSectionProps {
  supply: InvestigationSupplyData;
  params: InvestigationParams;
}

export const SupplyCoverageSection = ({ supply, params }: SupplyCoverageSectionProps): JSX.Element => {
  const supplierLookup = buildSupplierLookup(supply.suppliers);
  const leadTimeLookup = buildLeadTimeLookup(supply.leadTimeStats);
  const summaryCards = summarizeSupplyCoverage(supply);

  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-section-label">Supply Risk</p>
          <h4 className="mt-1 text-subheading text-ink">Supplier coverage and open inbound risk</h4>
          <p className="mt-1.5 text-sm leading-relaxed text-steel">
            Supplier context and open inbound coverage sourced from supplier mappings, lead-time stats, and open purchase orders that reference this SKU.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={buildSupplyExecutionHref({
              skuId: params.skuId,
              locationId: params.locationId,
            })}
            className={`${uiButtonSecondaryClassName} text-xs`}
          >
            Open supply execution
          </Link>
          <Link
            to={buildBuyerActionsHref({
              skuId: params.skuId,
              locationId: params.locationId,
            })}
            className={`${uiButtonSecondaryClassName} text-xs`}
          >
            Open buyer actions
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <DataField key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Supplier mappings</h5>
          <div className="space-y-4">
            {supply.mappings.length > 0 ? (
              supply.mappings.map((mapping) => {
                const supplier = supplierLookup.get(mapping.supplierId);
                const leadTimeStat = leadTimeLookup.get(mapping.supplierId) ?? null;

                return (
                  <div key={mapping.id} className="rounded-radius-lg border border-slate-200/60 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {supplier ? `${supplier.code} - ${supplier.name}` : mapping.supplierId}
                        </p>
                        <p className="mt-0.5 text-xs text-steel">
                          {mapping.isPrimary ? "Primary supplier mapping" : "Secondary supplier mapping"}
                        </p>
                      </div>
                      <StatusChip tone={supplier?.status === "active" ? "success" : "neutral"}>
                        {supplier?.status ?? "Unknown status"}
                      </StatusChip>
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-steel">MOQ</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-ink">{formatNumber(mapping.minOrderQty)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Case pack</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-ink">{formatNumber(mapping.casePackQty)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Config lead time</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-ink">{formatNumber(mapping.leadTimeDays)}d</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Observed lead</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-ink">
                          {leadTimeStat?.averageLeadTimeDays != null ? `${formatNumber(leadTimeStat.averageLeadTimeDays)}d` : "--"}
                        </p>
                      </div>
                    </div>

                    {leadTimeStat ? (
                      <p className="mt-4 rounded-radius-md border border-slate-100/80 bg-slate-50/80 px-3 py-2 text-xs text-steel">
                        Last observed {formatDateTime(leadTimeStat.lastObservedAt)} from {formatNumber(leadTimeStat.sampleCount)} receipt samples.
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <EmptyState title="No mappings" message="No supplier mapping is currently exposed for this SKU." />
            )}
          </div>
        </div>

        <div>
          <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">Open purchase orders</h5>
          <div className="space-y-4">
            {supply.openPurchaseOrders.length > 0 ? (
              supply.openPurchaseOrders.map((entry) => {
                const supplier = supplierLookup.get(entry.purchaseOrder.supplierId);

                return (
                  <div key={entry.purchaseOrder.id} className="rounded-radius-lg border border-slate-200/60 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{entry.purchaseOrder.poNumber}</p>
                        <p className="mt-0.5 text-xs text-steel">
                          {supplier ? `${supplier.code} - ${supplier.name}` : entry.purchaseOrder.supplierId}
                        </p>
                      </div>
                      <StatusChip tone="info">{formatPurchaseOrderStatus(entry.purchaseOrder.status)}</StatusChip>
                    </div>

                    <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Open quantity</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-ink">{formatNumber(entry.openQuantity)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Expected delivery</p>
                        <p className="mt-1 text-sm font-medium tabular-nums text-ink">
                          {formatDateTime(entry.purchaseOrder.expectedDeliveryAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState title="No orders" message="No open purchase order currently references this SKU/location scope through the exposed purchase order read model." />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
