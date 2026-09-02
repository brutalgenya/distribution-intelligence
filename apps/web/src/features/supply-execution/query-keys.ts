import type { PurchaseOrderStatus } from "./types";
import type { SupplyExecutionRouteParams } from "./types";

export const supplyExecutionKeys = {
  all: ["supply-execution"] as const,
  skus: (userId: string, organizationId: string) =>
    [...supplyExecutionKeys.all, "skus", userId, organizationId] as const,
  locations: (userId: string, organizationId: string) =>
    [...supplyExecutionKeys.all, "locations", userId, organizationId] as const,
  purchaseOrders: (
    userId: string,
    organizationId: string,
    filters: { status?: PurchaseOrderStatus | "all"; supplierId?: string | null },
  ) => [...supplyExecutionKeys.all, "purchase-orders", userId, organizationId, filters] as const,
  purchaseOrderDetail: (userId: string, organizationId: string, purchaseOrderId: string) =>
    [...supplyExecutionKeys.all, "purchase-order-detail", userId, organizationId, purchaseOrderId] as const,
  suppliers: (userId: string, organizationId: string) =>
    [...supplyExecutionKeys.all, "suppliers", userId, organizationId] as const,
  supplierDetail: (userId: string, organizationId: string, supplierId: string) =>
    [...supplyExecutionKeys.all, "supplier-detail", userId, organizationId, supplierId] as const,
  supplierPerformance: (userId: string, organizationId: string, supplierId: string) =>
    [...supplyExecutionKeys.all, "supplier-performance", userId, organizationId, supplierId] as const,
  supplierLeadTimes: (userId: string, organizationId: string, supplierId: string) =>
    [...supplyExecutionKeys.all, "supplier-lead-times", userId, organizationId, supplierId] as const,
  supplierMappingsBySupplier: (userId: string, organizationId: string, supplierId: string) =>
    [...supplyExecutionKeys.all, "supplier-mappings-by-supplier", userId, organizationId, supplierId] as const,
  supplierMappingsBySku: (userId: string, organizationId: string, skuId: string) =>
    [...supplyExecutionKeys.all, "supplier-mappings-by-sku", userId, organizationId, skuId] as const,
  stockouts: (userId: string, organizationId: string, input: { skuId: string; locationId: string }) =>
    [...supplyExecutionKeys.all, "stockouts", userId, organizationId, input] as const,
  context: (userId: string, organizationId: string, params: SupplyExecutionRouteParams) =>
    [...supplyExecutionKeys.all, "context", userId, organizationId, params] as const,
};
