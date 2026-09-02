import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildBuyerActionsHref } from "../../buyer-actions/route";
import { buildInvestigationHref } from "../../investigation/route";
import {
  buildLocationLookup,
  buildSkuLookup,
  formatPurchaseOrderStatus,
  selectPurchaseOrderLineScopeLabel,
} from "../selectors";
import type {
  Location,
  PurchaseOrder,
  Sku,
  Supplier,
  SupplierPerformanceSnapshot,
} from "../types";
import { PartialDataNotice } from "./SupplyExecutionStates";

interface PurchaseOrderDetailPanelProps {
  purchaseOrder: PurchaseOrder | null;
  supplier: Supplier | null;
  supplierPerformance: SupplierPerformanceSnapshot | null;
  skus: Sku[];
  locations: Location[];
}

const cardClassName = "rounded-[28px] border border-black/8 bg-white p-5 shadow-panel";

export const PurchaseOrderDetailPanel = ({
  purchaseOrder,
  supplier,
  supplierPerformance,
  skus,
  locations,
}: PurchaseOrderDetailPanelProps): JSX.Element => {
  if (!purchaseOrder) {
    return (
      <section className={cardClassName}>
      <p className="text-xs uppercase tracking-[0.2em] text-steel">Selected order</p>
        <h4 className="mt-2 text-xl font-semibold text-ink">Purchase order detail</h4>
        <p className="mt-3 text-sm leading-6 text-steel">
          Select a purchase order from the queue to inspect line items, supplier context, receipt progress, and
          follow-through evidence.
        </p>
      </section>
    );
  }

  const skuLookup = buildSkuLookup(skus);
  const locationLookup = buildLocationLookup(locations);
  const orderedQty = purchaseOrder.lines.reduce((sum, line) => sum + line.quantityOrdered, 0);
  const receivedQty = purchaseOrder.lines.reduce((sum, line) => sum + line.quantityReceived, 0);
  const openQty = purchaseOrder.lines.reduce(
    (sum, line) => sum + Math.max(line.quantityOrdered - line.quantityReceived, 0),
    0,
  );

  return (
    <section className={cardClassName}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <p className="text-xs uppercase tracking-[0.2em] text-steel">Selected order</p>
          <h4 className="mt-2 text-2xl font-semibold text-ink">{purchaseOrder.poNumber}</h4>
          <p className="mt-2 text-sm leading-6 text-steel">
            {supplier ? `${supplier.code} - ${supplier.name}` : purchaseOrder.supplierId}
          </p>
        </div>

        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-steel">
          {formatPurchaseOrderStatus(purchaseOrder.status)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to={buildBuyerActionsHref({
            purchaseOrderId: purchaseOrder.id,
            supplierId: purchaseOrder.supplierId,
          })}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5"
        >
          Open buyer actions
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
        <div className="rounded-2xl bg-mist px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Ordered quantity</p>
          <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(orderedQty)}</p>
        </div>
        <div className="rounded-2xl bg-mist px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Received quantity</p>
          <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(receivedQty)}</p>
        </div>
        <div className="rounded-2xl bg-mist px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Open quantity</p>
          <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(openQty)}</p>
        </div>
        <div className="rounded-2xl bg-mist px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Expected delivery</p>
          <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(purchaseOrder.expectedDeliveryAt)}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-steel">Purchase order id</dt>
          <dd className="mt-2 break-all text-sm font-semibold text-ink">{purchaseOrder.id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-steel">Ordered at</dt>
          <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(purchaseOrder.orderedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-steel">Received at</dt>
          <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(purchaseOrder.receivedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-steel">Delayed at</dt>
          <dd className="mt-2 text-sm font-semibold text-ink">{formatDateTime(purchaseOrder.delayedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-steel">Currency</dt>
          <dd className="mt-2 text-sm font-semibold text-ink">{purchaseOrder.currency ?? "Not available"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-steel">Created by</dt>
          <dd className="mt-2 text-sm font-semibold text-ink">{purchaseOrder.createdByUserId}</dd>
        </div>
      </dl>

      {purchaseOrder.notes ? (
        <div className="mt-5 rounded-2xl bg-mist px-4 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Notes</p>
          <p className="mt-2 text-sm leading-6 text-ink">{purchaseOrder.notes}</p>
        </div>
      ) : (
        <div className="mt-5">
          <PartialDataNotice
            title="Structured remediation linkage is not exposed"
            message="The purchase order read model exposes notes, status, timestamps, and line receipts. It does not expose structured decision or execution references yet, so this panel avoids inventing hidden joins."
          />
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-[24px] border border-black/8">
        <div className="border-b border-black/6 bg-cloud px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-steel">Line items</p>
          <h5 className="mt-2 text-lg font-semibold text-ink">Ordered versus received quantities</h5>
        </div>
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-white">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-steel">
                <th className="px-4 py-4 font-semibold">Scope</th>
                <th className="px-4 py-4 font-semibold">Ordered</th>
                <th className="px-4 py-4 font-semibold">Received</th>
                <th className="px-4 py-4 font-semibold">Open</th>
                <th className="px-4 py-4 font-semibold">Unit cost</th>
                <th className="px-4 py-4 font-semibold">Investigation</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrder.lines.map((line) => (
                <tr key={line.id} className="border-t border-black/6 bg-white">
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    <p className="font-semibold">
                      {selectPurchaseOrderLineScopeLabel(line, {
                        skuById: skuLookup,
                        locationById: locationLookup,
                      })}
                    </p>
                    <p className="mt-1 text-steel">{line.id}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">{formatNumber(line.quantityOrdered)}</td>
                  <td className="px-4 py-4 align-top text-sm text-ink">{formatNumber(line.quantityReceived)}</td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {formatNumber(Math.max(line.quantityOrdered - line.quantityReceived, 0))}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">{formatNumber(line.unitCost)}</td>
                  <td className="px-4 py-4 align-top">
                    {line.expectedLocationId ? (
                      <Link
                        to={buildInvestigationHref(line.skuId, line.expectedLocationId)}
                        className="inline-flex rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5"
                      >
                        Open investigation
                      </Link>
                    ) : (
                      <span className="text-sm text-steel">Location not assigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2 2xl:grid-cols-1">
        <div className="rounded-2xl bg-mist px-4 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Supplier context</p>
          <p className="mt-2 text-sm leading-6 text-ink">
            {supplier
              ? `${supplier.code} - ${supplier.name} (${supplier.status})`
              : "Supplier detail is not available for the selected purchase order."}
          </p>
        </div>
        <div className="rounded-2xl bg-mist px-4 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Supplier performance snapshot</p>
          <p className="mt-2 text-sm leading-6 text-ink">
            {supplierPerformance
              ? `${formatNumber(supplierPerformance.delayedPurchaseOrders)} delayed out of ${formatNumber(
                  supplierPerformance.totalPurchaseOrders,
                )} total purchase orders. Last receipt ${formatDateTime(supplierPerformance.lastReceiptAt)}.`
              : "Supplier performance is not currently loaded for this supplier context."}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <PartialDataNotice
          title="Status history is not exposed"
          message="The backend read model exposes current purchase order status, timestamps, and line receipts, but not a detailed status-history timeline or receipt-event log yet."
        />
      </div>
    </section>
  );
};
