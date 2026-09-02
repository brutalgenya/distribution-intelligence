import clsx from "clsx";
import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { formatPurchaseOrderStatus, getPurchaseOrderStatusTone } from "../../supply-execution/selectors";
import { buildBuyerActionsHref } from "../route";
import { formatAvailableActions } from "../selectors";
import type {
  BuyerActionsFilters,
  BuyerActionsRouteParams,
  BuyerActionType,
  BuyerPurchaseOrderQueueRow,
  PurchaseOrderStatus,
  Supplier,
} from "../types";

interface ActionablePurchaseOrderQueueSectionProps {
  rows: BuyerPurchaseOrderQueueRow[];
  suppliers: Supplier[];
  filters: BuyerActionsFilters;
  selectedPurchaseOrderId: string | null;
  context: {
    skuId: string | null;
    locationId: string | null;
  };
  onFiltersChange: (filters: BuyerActionsFilters) => void;
  onSelectPurchaseOrder: (purchaseOrderId: string | null) => void;
}

const purchaseOrderStatusOptions: Array<{
  value: PurchaseOrderStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "partially_received", label: "Partially received" },
  { value: "delayed", label: "Delayed" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

const buyerActionOptions: Array<{
  value: BuyerActionType | "all";
  label: string;
}> = [
  { value: "all", label: "All actions" },
  { value: "submit", label: "Ready to submit" },
  { value: "delay", label: "Delay available" },
  { value: "receive", label: "Ready to receive" },
];

export const ActionablePurchaseOrderQueueSection = ({
  rows,
  suppliers,
  filters,
  selectedPurchaseOrderId,
  context,
  onFiltersChange,
  onSelectPurchaseOrder,
}: ActionablePurchaseOrderQueueSectionProps): JSX.Element => (
  <section className="space-y-4">
    <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Action queue</p>
      <h3 className="mt-2 text-3xl font-semibold text-ink">Action-ready purchase orders</h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
        Use server-backed status and supplier filters first, then refine the visible queue by search text and the
        buyer action you need to take right now.
      </p>
    </div>

    <div className="rounded-[28px] border border-black/8 bg-white shadow-panel">
      <div className="grid gap-4 border-b border-black/6 px-5 py-4 xl:grid-cols-2 2xl:grid-cols-3">
        <label className="space-y-2 2xl:col-span-2">
          <span className="text-xs uppercase tracking-[0.16em] text-steel">Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as BuyerActionsFilters["status"],
              })
            }
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine"
          >
            {purchaseOrderStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.16em] text-steel">Supplier</span>
          <select
            value={filters.supplierId ?? ""}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                supplierId: event.target.value.length > 0 ? event.target.value : null,
              })
            }
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine"
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} - {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.16em] text-steel">Action</span>
          <select
            value={filters.action}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                action: event.target.value as BuyerActionsFilters["action"],
              })
            }
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine"
          >
            {buyerActionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.16em] text-steel">Search</span>
          <input
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                search: event.target.value,
              })
            }
            placeholder="Search PO id, PO number, or supplier"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-steel/70 focus:border-pine"
          />
        </label>

        <div className="flex items-end 2xl:justify-end">
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                status: "all",
                supplierId: null,
                action: "all",
                search: "",
              })
            }
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5"
          >
            Clear filters
          </button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-cloud">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-steel">
                <th className="px-4 py-4 font-semibold">Purchase order</th>
                <th className="px-4 py-4 font-semibold">Supplier</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold">Expected delivery</th>
                <th className="px-4 py-4 font-semibold">Received / ordered</th>
                <th className="px-4 py-4 font-semibold">Actionable now</th>
                <th className="px-4 py-4 font-semibold">Workspace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const tone = getPurchaseOrderStatusTone(row.purchaseOrder.status);
                const href = buildBuyerActionsHref({
                  purchaseOrderId: row.purchaseOrder.id,
                  supplierId: row.purchaseOrder.supplierId,
                  skuId: context.skuId,
                  locationId: context.locationId,
                  status: filters.status,
                  action: filters.action,
                  search: filters.search,
                } satisfies Partial<BuyerActionsRouteParams>);

                return (
                  <tr
                    key={row.purchaseOrder.id}
                    className={clsx(
                      "cursor-pointer border-t border-black/6 transition hover:bg-pine/4",
                      selectedPurchaseOrderId === row.purchaseOrder.id ? "bg-pine/6" : tone.rowClassName,
                    )}
                    onClick={() => onSelectPurchaseOrder(row.purchaseOrder.id)}
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-ink">{row.purchaseOrder.poNumber}</p>
                      <p className="mt-1 text-sm text-steel">{row.purchaseOrder.id}</p>
                      {row.matchingLineCount > 0 ? (
                        <p className="mt-1 text-sm text-steel">
                          Matching scoped lines: {formatNumber(row.matchingLineCount)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-ink">
                      {row.supplier ? `${row.supplier.code} - ${row.supplier.name}` : row.purchaseOrder.supplierId}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone.badgeClassName}`}>
                        {formatPurchaseOrderStatus(row.purchaseOrder.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-ink">
                      <p>{formatDateTime(row.purchaseOrder.expectedDeliveryAt)}</p>
                      <p className="mt-1 text-steel">Created {formatDateTime(row.purchaseOrder.createdAt)}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-ink">
                      <p>
                        {formatNumber(row.receivedQty)} / {formatNumber(row.orderedQty)}
                      </p>
                      <p className="mt-1 text-steel">Open {formatNumber(row.openQty)}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-ink">
                      {formatAvailableActions(row.availableActions)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Link
                        to={href}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5"
                      >
                        Open buyer actions
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-6">
          <p className="rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
            No purchase orders match the current action, status, supplier, search, and scope filters.
          </p>
        </div>
      )}
    </div>
  </section>
);
