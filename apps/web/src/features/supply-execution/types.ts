import type { MetricTone, Location, Sku, StockoutIncident } from "../outcomes/types";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierLeadTimeStat,
  SupplierSku,
} from "../investigation/types";

export type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierLeadTimeStat,
  SupplierSku,
  Location,
  Sku,
  StockoutIncident,
};

export interface SupplierPerformanceSnapshot {
  id: string;
  organizationId: string;
  supplierId: string;
  totalPurchaseOrders: number;
  delayedPurchaseOrders: number;
  receivedPurchaseOrders: number;
  averageLeadTimeDays: number | null;
  lastReceiptAt: string | null;
  updatedAt: string;
}

export interface SupplyExecutionRouteParams {
  purchaseOrderId: string | null;
  supplierId: string | null;
  skuId: string | null;
  locationId: string | null;
  status: PurchaseOrderStatus | "all";
  search: string;
}

export interface SupplyExecutionFilters {
  status: PurchaseOrderStatus | "all";
  supplierId: string | null;
  search: string;
}

export interface PurchaseOrderQueueRow {
  purchaseOrder: PurchaseOrder;
  supplier: Supplier | null;
  orderedQty: number;
  receivedQty: number;
  openQty: number;
  matchingScope: boolean;
  matchingLineCount: number;
}

export interface SupplierCoverageRow {
  supplier: Supplier;
  openPurchaseOrderCount: number;
  delayedPurchaseOrderCount: number;
  partiallyReceivedCount: number;
  openQuantity: number;
}

export interface SupplyExecutionSummaryCard {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: MetricTone;
}

export interface SupplyClosureSignal {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: MetricTone;
}

export interface SupplyExecutionContextSummary {
  sku: Sku | null;
  location: Location | null;
  stockouts: StockoutIncident[];
}
