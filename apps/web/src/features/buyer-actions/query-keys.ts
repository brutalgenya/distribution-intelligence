import type { BuyerActionsRouteParams, PurchaseOrderStatus } from "./types";

export const buyerActionsKeys = {
  all: ["buyer-actions"] as const,
  skus: (userId: string, organizationId: string) =>
    [...buyerActionsKeys.all, "skus", userId, organizationId] as const,
  locations: (userId: string, organizationId: string) =>
    [...buyerActionsKeys.all, "locations", userId, organizationId] as const,
  purchaseOrders: (
    userId: string,
    organizationId: string,
    filters: { status?: PurchaseOrderStatus | "all"; supplierId?: string | null },
  ) => [...buyerActionsKeys.all, "purchase-orders", userId, organizationId, filters] as const,
  purchaseOrderDetail: (userId: string, organizationId: string, purchaseOrderId: string) =>
    [...buyerActionsKeys.all, "purchase-order-detail", userId, organizationId, purchaseOrderId] as const,
  suppliers: (userId: string, organizationId: string) =>
    [...buyerActionsKeys.all, "suppliers", userId, organizationId] as const,
  supplierDetail: (userId: string, organizationId: string, supplierId: string) =>
    [...buyerActionsKeys.all, "supplier-detail", userId, organizationId, supplierId] as const,
  supplierPerformance: (userId: string, organizationId: string, supplierId: string) =>
    [...buyerActionsKeys.all, "supplier-performance", userId, organizationId, supplierId] as const,
  supplierLeadTimes: (userId: string, organizationId: string, supplierId: string) =>
    [...buyerActionsKeys.all, "supplier-lead-times", userId, organizationId, supplierId] as const,
  context: (userId: string, organizationId: string, params: BuyerActionsRouteParams) =>
    [...buyerActionsKeys.all, "context", userId, organizationId, params] as const,
};
