import type {
  Location,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
  Sku,
} from "../supply-execution/types";

export type {
  Location,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
  Sku,
};

export type BuyerActionType = "submit" | "delay" | "receive";

export interface BuyerActionsRouteParams {
  purchaseOrderId: string | null;
  supplierId: string | null;
  skuId: string | null;
  locationId: string | null;
  status: PurchaseOrderStatus | "all";
  action: BuyerActionType | "all";
  search: string;
}

export interface BuyerActionsFilters {
  status: PurchaseOrderStatus | "all";
  supplierId: string | null;
  action: BuyerActionType | "all";
  search: string;
}

export interface DelayPurchaseOrderInput {
  expectedDeliveryAt?: string;
  notes?: string;
}

export interface ReceivePurchaseOrderLineInput {
  lineId: string;
  quantityReceived: number;
  locationId?: string;
}

export interface ReceivePurchaseOrderInput {
  receivedAt?: string;
  lines: ReceivePurchaseOrderLineInput[];
}

export interface BuyerActionsSummaryCard {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: "critical" | "warning" | "positive" | "neutral";
}

export interface BuyerPurchaseOrderQueueRow {
  purchaseOrder: PurchaseOrder;
  supplier: Supplier | null;
  orderedQty: number;
  receivedQty: number;
  openQty: number;
  matchingScope: boolean;
  matchingLineCount: number;
  availableActions: BuyerActionType[];
}

export interface BuyerActionsMutationSummary {
  action: BuyerActionType;
  purchaseOrderId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  message: string;
  updatedAt: string;
}

export interface BuyerActionFeedback {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
}
