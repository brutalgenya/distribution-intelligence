import { formatDateTime, formatNumber } from "../../lib/utils/format";
import {
  deriveFocusedSupplierId,
  formatPurchaseOrderStatus,
  getPurchaseOrderOpenQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderReceivedQty,
  matchesScopeLine,
} from "../supply-execution/selectors";
import type {
  BuyerActionType,
  BuyerActionsFilters,
  BuyerActionsMutationSummary,
  BuyerActionsSummaryCard,
  BuyerPurchaseOrderQueueRow,
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
  SupplierPerformanceSnapshot,
} from "./types";

const getTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

export const formatBuyerActionType = (value: BuyerActionType): string => {
  switch (value) {
    case "submit":
      return "Ready to submit";
    case "delay":
      return "Delay available";
    case "receive":
      return "Ready to receive";
  }
};

export const canSubmitPurchaseOrder = (status: PurchaseOrderStatus): boolean =>
  status === "draft";

export const canDelayPurchaseOrder = (status: PurchaseOrderStatus): boolean =>
  status === "submitted";

export const canReceivePurchaseOrder = (status: PurchaseOrderStatus): boolean =>
  status === "submitted" || status === "delayed" || status === "partially_received";

export const getAvailableBuyerActions = (
  purchaseOrder: PurchaseOrder,
): BuyerActionType[] => {
  const actions: BuyerActionType[] = [];

  if (canSubmitPurchaseOrder(purchaseOrder.status)) {
    actions.push("submit");
  }

  if (canDelayPurchaseOrder(purchaseOrder.status)) {
    actions.push("delay");
  }

  if (canReceivePurchaseOrder(purchaseOrder.status)) {
    actions.push("receive");
  }

  return actions;
};

export const deriveBuyerActionsQueueRows = (input: {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  filters: BuyerActionsFilters;
  context: { skuId: string | null; locationId: string | null };
}): BuyerPurchaseOrderQueueRow[] => {
  const supplierLookup = new Map(
    input.suppliers.map((supplier) => [supplier.id, supplier] as const),
  );
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
        availableActions: getAvailableBuyerActions(purchaseOrder),
      } satisfies BuyerPurchaseOrderQueueRow;
    })
    .filter((row) => row.matchingScope)
    .filter((row) => {
      if (input.filters.action === "all") {
        return true;
      }

      return row.availableActions.includes(input.filters.action);
    })
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

export const deriveBuyerActionsSummaryCards = (input: {
  queueRows: BuyerPurchaseOrderQueueRow[];
  selectedSupplierPerformance: SupplierPerformanceSnapshot | null;
}): BuyerActionsSummaryCard[] => {
  const draftRows = input.queueRows.filter((row) => row.purchaseOrder.status === "draft");
  const delayedRows = input.queueRows.filter((row) => row.purchaseOrder.status === "delayed");
  const receiptReadyRows = input.queueRows.filter((row) =>
    row.availableActions.includes("receive"),
  );
  const partialRows = input.queueRows.filter(
    (row) => row.purchaseOrder.status === "partially_received",
  );
  const openQty = input.queueRows.reduce((sum, row) => sum + row.openQty, 0);

  return [
    {
      id: "draft-pos",
      label: "Draft purchase orders",
      value: formatNumber(draftRows.length),
      helper: "Purchase orders that can be submitted through the real supply mutation route.",
      tone: draftRows.length > 0 ? "warning" : "positive",
    },
    {
      id: "receipt-ready",
      label: "Receipt-ready orders",
      value: formatNumber(receiptReadyRows.length),
      helper: "Submitted, delayed, or partially received orders that can take cumulative receipt input.",
      tone: receiptReadyRows.length > 0 ? "warning" : "neutral",
    },
    {
      id: "delayed-pos",
      label: "Delayed purchase orders",
      value: formatNumber(delayedRows.length),
      helper: input.selectedSupplierPerformance
        ? `Focused supplier history shows ${formatNumber(
            input.selectedSupplierPerformance.delayedPurchaseOrders,
          )} delayed purchase orders so far.`
        : "These orders are already persisted in delayed status and need follow-through, not guesswork.",
      tone: delayedRows.length > 0 ? "critical" : "positive",
    },
    {
      id: "partial-receipts",
      label: "Partially received orders",
      value: formatNumber(partialRows.length),
      helper: "Receiving has started, but outstanding quantity is still open.",
      tone: partialRows.length > 0 ? "warning" : "neutral",
    },
    {
      id: "open-qty",
      label: "Open inbound quantity",
      value: formatNumber(openQty),
      helper: "Outstanding quantity across the visible action queue.",
      tone: openQty > 0 ? "neutral" : "positive",
    },
  ];
};

export const deriveBuyerActionsFreshness = (input: {
  purchaseOrders: PurchaseOrder[];
  selectedSupplierPerformance: SupplierPerformanceSnapshot | null;
}): string | null => {
  const timestamps = [
    ...input.purchaseOrders.map((purchaseOrder) => purchaseOrder.updatedAt),
    input.selectedSupplierPerformance?.updatedAt ?? null,
  ].filter((value): value is string => Boolean(value));

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort((left, right) => getTimestamp(right) - getTimestamp(left))[0] ?? null;
};

export const buildBuyerActionMutationSummary = (input: {
  action: BuyerActionType;
  purchaseOrder: PurchaseOrder;
}): BuyerActionsMutationSummary => {
  const orderedQty = getPurchaseOrderOrderedQty(input.purchaseOrder);
  const receivedQty = getPurchaseOrderReceivedQty(input.purchaseOrder);
  const openQty = getPurchaseOrderOpenQty(input.purchaseOrder);

  const message =
    input.action === "submit"
      ? `Backend status is now ${formatPurchaseOrderStatus(
          input.purchaseOrder.status,
        )}. Ordered at ${formatDateTime(input.purchaseOrder.orderedAt)}.`
      : input.action === "delay"
        ? `Backend status is now ${formatPurchaseOrderStatus(
            input.purchaseOrder.status,
          )}. Expected delivery ${formatDateTime(input.purchaseOrder.expectedDeliveryAt)}.`
        : `Backend receipt totals are ${formatNumber(receivedQty)} of ${formatNumber(
            orderedQty,
          )}, with ${formatNumber(openQty)} still open.`;

  return {
    action: input.action,
    purchaseOrderId: input.purchaseOrder.id,
    poNumber: input.purchaseOrder.poNumber,
    status: input.purchaseOrder.status,
    message,
    updatedAt: input.purchaseOrder.updatedAt,
  };
};

export const formatAvailableActions = (
  actions: BuyerActionType[],
): string => {
  if (actions.length === 0) {
    return "No supported action";
  }

  return actions.map(formatBuyerActionType).join(" | ");
};

export { deriveFocusedSupplierId };
