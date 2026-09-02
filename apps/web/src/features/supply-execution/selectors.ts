import { formatDateTime, formatLabel, formatNumber } from "../../lib/utils/format";
import type { Location, Sku } from "../outcomes/types";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderQueueRow,
  PurchaseOrderStatus,
  Supplier,
  SupplierCoverageRow,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
  StockoutIncident,
  SupplyClosureSignal,
  SupplyExecutionContextSummary,
  SupplyExecutionFilters,
  SupplyExecutionSummaryCard,
} from "./types";

const getTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

const getMaxTimestamp = (values: Array<string | null | undefined>): string | null =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => getTimestamp(right) - getTimestamp(left))[0] ?? null;

export const formatPurchaseOrderStatus = (value: PurchaseOrderStatus): string =>
  value === "partially_received" ? "Partially received" : formatLabel(value);

export const formatSupplierStatus = (value: Supplier["status"]): string => formatLabel(value);

export const getPurchaseOrderStatusTone = (
  status: PurchaseOrderStatus,
): { badgeClassName: string; rowClassName: string } => {
  switch (status) {
    case "delayed":
      return {
        badgeClassName: "bg-red-100 text-red-700",
        rowClassName: "bg-red-50/30",
      };
    case "partially_received":
      return {
        badgeClassName: "bg-amber-100 text-amber-800",
        rowClassName: "bg-amber-50/30",
      };
    case "received":
      return {
        badgeClassName: "bg-pine/15 text-pine",
        rowClassName: "bg-pine/8",
      };
    case "submitted":
      return {
        badgeClassName: "bg-sky-100 text-sky-700",
        rowClassName: "bg-sky-50/25",
      };
    case "draft":
    case "cancelled":
      return {
        badgeClassName: "bg-black/5 text-steel",
        rowClassName: "bg-white",
      };
  }
};

export const isOpenPurchaseOrderStatus = (status: PurchaseOrderStatus): boolean =>
  status !== "received" && status !== "cancelled";

export const getPurchaseOrderOrderedQty = (purchaseOrder: PurchaseOrder): number =>
  purchaseOrder.lines.reduce((sum, line) => sum + line.quantityOrdered, 0);

export const getPurchaseOrderReceivedQty = (purchaseOrder: PurchaseOrder): number =>
  purchaseOrder.lines.reduce((sum, line) => sum + line.quantityReceived, 0);

export const getPurchaseOrderOpenQty = (purchaseOrder: PurchaseOrder): number =>
  purchaseOrder.lines.reduce(
    (sum, line) => sum + Math.max(line.quantityOrdered - line.quantityReceived, 0),
    0,
  );

export const matchesScopeLine = (
  line: PurchaseOrderLine,
  input: { skuId: string | null; locationId: string | null },
): boolean => {
  if (!input.skuId) {
    return true;
  }

  if (line.skuId !== input.skuId) {
    return false;
  }

  return !input.locationId || line.expectedLocationId === input.locationId;
};

export const buildSupplierLookup = (suppliers: Supplier[]): Map<string, Supplier> =>
  new Map(suppliers.map((supplier) => [supplier.id, supplier]));

export const buildSkuLookup = (skus: Sku[]): Map<string, Sku> =>
  new Map(skus.map((sku) => [sku.id, sku]));

export const buildLocationLookup = (locations: Location[]): Map<string, Location> =>
  new Map(locations.map((location) => [location.id, location]));

export const derivePurchaseOrderQueueRows = (input: {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  filters: SupplyExecutionFilters;
  context: { skuId: string | null; locationId: string | null };
}): PurchaseOrderQueueRow[] => {
  const supplierLookup = buildSupplierLookup(input.suppliers);
  const normalizedSearch = input.filters.search.trim().toLowerCase();

  return input.purchaseOrders
    .map((purchaseOrder) => {
      const matchingLineCount = purchaseOrder.lines.filter((line) =>
        matchesScopeLine(line, input.context),
      ).length;

      return {
        purchaseOrder,
        supplier: supplierLookup.get(purchaseOrder.supplierId) ?? null,
        orderedQty: getPurchaseOrderOrderedQty(purchaseOrder),
        receivedQty: getPurchaseOrderReceivedQty(purchaseOrder),
        openQty: getPurchaseOrderOpenQty(purchaseOrder),
        matchingScope: input.context.skuId ? matchingLineCount > 0 : true,
        matchingLineCount,
      } satisfies PurchaseOrderQueueRow;
    })
    .filter((row) => row.matchingScope)
    .filter((row) => {
      if (normalizedSearch.length === 0) {
        return true;
      }

      return (
        row.purchaseOrder.id.toLowerCase().includes(normalizedSearch) ||
        row.purchaseOrder.poNumber.toLowerCase().includes(normalizedSearch) ||
        row.supplier?.name.toLowerCase().includes(normalizedSearch) === true ||
        row.supplier?.code.toLowerCase().includes(normalizedSearch) === true
      );
    })
    .sort((left, right) => {
      const leftDate = left.purchaseOrder.expectedDeliveryAt ?? left.purchaseOrder.createdAt;
      const rightDate = right.purchaseOrder.expectedDeliveryAt ?? right.purchaseOrder.createdAt;
      return getTimestamp(leftDate) - getTimestamp(rightDate);
    });
};

export const deriveFocusedSupplierId = (input: {
  explicitSupplierId: string | null;
  selectedPurchaseOrder: PurchaseOrder | null;
}): string | null => input.explicitSupplierId ?? input.selectedPurchaseOrder?.supplierId ?? null;

export const deriveSupplySummaryCards = (input: {
  queueRows: PurchaseOrderQueueRow[];
  selectedSupplierPerformance: SupplierPerformanceSnapshot | null;
}): SupplyExecutionSummaryCard[] => {
  const openRows = input.queueRows.filter((row) => isOpenPurchaseOrderStatus(row.purchaseOrder.status));
  const delayedRows = input.queueRows.filter((row) => row.purchaseOrder.status === "delayed");
  const partiallyReceivedRows = input.queueRows.filter(
    (row) => row.purchaseOrder.status === "partially_received",
  );
  const suppliersWithOpenDelays = new Set(delayedRows.map((row) => row.purchaseOrder.supplierId));
  const openInboundQty = openRows.reduce((sum, row) => sum + row.openQty, 0);

  return [
    {
      id: "open-orders",
      label: "Open purchase orders",
      value: formatNumber(openRows.length),
      helper: "Open supply orders that still need receipt-driven closure.",
      tone: openRows.length > 0 ? "warning" : "positive",
    },
    {
      id: "delayed-orders",
      label: "Delayed purchase orders",
      value: formatNumber(delayedRows.length),
      helper: "Purchase orders currently persisted in delayed status.",
      tone: delayedRows.length > 0 ? "critical" : "positive",
    },
    {
      id: "partially-received-orders",
      label: "Partially received orders",
      value: formatNumber(partiallyReceivedRows.length),
      helper: "Receipt progress started, but the purchase order is still open.",
      tone: partiallyReceivedRows.length > 0 ? "warning" : "neutral",
    },
    {
      id: "open-inbound-quantity",
      label: "Open inbound quantity",
      value: formatNumber(openInboundQty),
      helper: "Outstanding quantity still expected across the visible PO queue.",
      tone: openInboundQty > 0 ? "neutral" : "positive",
    },
    {
      id: "supplier-delay-signal",
      label: "Suppliers with open delays",
      value: formatNumber(suppliersWithOpenDelays.size),
      helper: input.selectedSupplierPerformance
        ? `Focused supplier history: ${formatNumber(
            input.selectedSupplierPerformance.delayedPurchaseOrders,
          )} delayed purchase orders persisted so far.`
        : "Visible supplier delay signal based on the currently delayed PO queue.",
      tone: suppliersWithOpenDelays.size > 0 ? "warning" : "positive",
    },
  ];
};

export const deriveSupplyFreshness = (input: {
  purchaseOrders: PurchaseOrder[];
  selectedSupplierPerformance: SupplierPerformanceSnapshot | null;
  stockouts: StockoutIncident[];
}): string | null =>
  getMaxTimestamp([
    ...input.purchaseOrders.map((purchaseOrder) => purchaseOrder.updatedAt),
    input.selectedSupplierPerformance?.updatedAt ?? null,
    ...input.stockouts.map((stockout) => stockout.updatedAt),
  ]);

export const deriveSupplierCoverageRows = (input: {
  suppliers: Supplier[];
  queueRows: PurchaseOrderQueueRow[];
}): SupplierCoverageRow[] => {
  const grouped = new Map<string, SupplierCoverageRow>();

  input.suppliers.forEach((supplier) => {
    grouped.set(supplier.id, {
      supplier,
      openPurchaseOrderCount: 0,
      delayedPurchaseOrderCount: 0,
      partiallyReceivedCount: 0,
      openQuantity: 0,
    });
  });

  input.queueRows.forEach((row) => {
    const entry = grouped.get(row.purchaseOrder.supplierId);
    if (!entry) {
      return;
    }

    if (isOpenPurchaseOrderStatus(row.purchaseOrder.status)) {
      entry.openPurchaseOrderCount += 1;
      entry.openQuantity += row.openQty;
    }

    if (row.purchaseOrder.status === "delayed") {
      entry.delayedPurchaseOrderCount += 1;
    }

    if (row.purchaseOrder.status === "partially_received") {
      entry.partiallyReceivedCount += 1;
    }
  });

  return [...grouped.values()]
    .filter((entry) => entry.openPurchaseOrderCount > 0 || entry.delayedPurchaseOrderCount > 0)
    .sort((left, right) => {
      const delayedDelta = right.delayedPurchaseOrderCount - left.delayedPurchaseOrderCount;
      if (delayedDelta !== 0) {
        return delayedDelta;
      }

      return right.openQuantity - left.openQuantity;
    })
    .slice(0, 8);
};

export const buildSupplyExecutionContextSummary = (input: {
  skuId: string | null;
  locationId: string | null;
  skus: Sku[];
  locations: Location[];
  stockouts: StockoutIncident[];
}): SupplyExecutionContextSummary => {
  const sku = input.skuId ? buildSkuLookup(input.skus).get(input.skuId) ?? null : null;
  const location = input.locationId
    ? buildLocationLookup(input.locations).get(input.locationId) ?? null
    : null;

  return {
    sku,
    location,
    stockouts: input.stockouts,
  };
};

export const selectPurchaseOrderLineScopeLabel = (
  line: PurchaseOrderLine,
  lookups: { skuById: Map<string, Sku>; locationById: Map<string, Location> },
): string => {
  const sku = lookups.skuById.get(line.skuId);
  const location = line.expectedLocationId
    ? lookups.locationById.get(line.expectedLocationId) ?? null
    : null;

  const skuLabel = sku ? `${sku.skuCode} - ${sku.name}` : line.skuId;
  const locationLabel = line.expectedLocationId
    ? location
      ? `${location.code} - ${location.name}`
      : line.expectedLocationId
    : "Unassigned receipt location";

  return `${skuLabel} @ ${locationLabel}`;
};

export const buildLeadTimeSummary = (
  stats: SupplierLeadTimeStat[],
): { average: string; latest: string; sampleCount: string } => {
  if (stats.length === 0) {
    return {
      average: "Not available",
      latest: "Not available",
      sampleCount: "0",
    };
  }

  const averageLeadTime =
    stats.reduce((sum, stat) => sum + stat.averageLeadTimeDays, 0) / stats.length;
  const latestStat = stats
    .slice()
    .sort((left, right) => getTimestamp(right.lastObservedAt) - getTimestamp(left.lastObservedAt))[0];
  const sampleCount = stats.reduce((sum, stat) => sum + stat.sampleCount, 0);

  return {
    average: formatNumber(averageLeadTime),
    latest: latestStat ? formatDateTime(latestStat.lastObservedAt) : "Not available",
    sampleCount: formatNumber(sampleCount),
  };
};

export const deriveClosureSignals = (input: {
  selectedPurchaseOrder: PurchaseOrder | null;
  stockouts: StockoutIncident[];
}): SupplyClosureSignal[] => {
  if (!input.selectedPurchaseOrder) {
    return [];
  }

  const purchaseOrder = input.selectedPurchaseOrder;
  const orderedQty = getPurchaseOrderOrderedQty(purchaseOrder);
  const receivedQty = getPurchaseOrderReceivedQty(purchaseOrder);
  const openQty = getPurchaseOrderOpenQty(purchaseOrder);
  const activeStockoutCount = input.stockouts.filter((stockout) => stockout.incidentEndAt === null).length;

  return [
    {
      id: "po-status",
      label: "Purchase order status",
      value: formatPurchaseOrderStatus(purchaseOrder.status),
      helper:
        purchaseOrder.status === "received"
          ? "The backend has marked this purchase order as fully received."
          : purchaseOrder.status === "partially_received"
            ? "Receipts have started, but this order is still open."
            : purchaseOrder.status === "delayed"
              ? "This order is currently persisted as delayed."
              : "Closure is still waiting on later submit, receipt, delay, or cancel events.",
      tone:
        purchaseOrder.status === "received"
          ? "positive"
          : purchaseOrder.status === "delayed"
            ? "critical"
            : purchaseOrder.status === "partially_received"
              ? "warning"
              : "neutral",
    },
    {
      id: "receipt-progress",
      label: "Receipt progress",
      value: `${formatNumber(receivedQty)} / ${formatNumber(orderedQty)}`,
      helper: `${formatNumber(openQty)} units are still outstanding on this order.`,
      tone: openQty === 0 ? "positive" : receivedQty > 0 ? "warning" : "neutral",
    },
    {
      id: "expected-arrival",
      label: "Expected delivery",
      value: formatDateTime(purchaseOrder.expectedDeliveryAt),
      helper:
        purchaseOrder.receivedAt !== null
          ? `Receipt was persisted on ${formatDateTime(purchaseOrder.receivedAt)}.`
          : "No final receipt timestamp is persisted yet for this order.",
      tone: purchaseOrder.receivedAt ? "positive" : "neutral",
    },
    {
      id: "scope-stockouts",
      label: "Open stockout incidents",
      value: formatNumber(activeStockoutCount),
      helper:
        activeStockoutCount > 0
          ? "Item-level incident evidence is still open for the current investigation scope."
          : "No open stockout incident is currently persisted for the selected item scope.",
      tone: activeStockoutCount > 0 ? "critical" : "positive",
    },
  ];
};
