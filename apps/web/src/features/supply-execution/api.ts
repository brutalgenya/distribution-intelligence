import type { ApiClient } from "../../lib/api/types";
import type { Location, Sku, StockoutIncident } from "../outcomes/types";
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
  SupplierSku,
} from "./types";

const buildQueryString = (filters: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
};

export const listSkus = (apiClient: ApiClient): Promise<Sku[]> => apiClient.get("/catalog/skus");

export const listLocations = (apiClient: ApiClient): Promise<Location[]> =>
  apiClient.get("/inventory/locations");

export const listPurchaseOrders = (
  apiClient: ApiClient,
  filters: { status?: PurchaseOrderStatus | "all"; supplierId?: string | null } = {},
): Promise<PurchaseOrder[]> =>
  apiClient.get(
    `/supply/purchase-orders${buildQueryString({
      status: filters.status && filters.status !== "all" ? filters.status : undefined,
      supplierId: filters.supplierId ?? undefined,
    })}`,
  );

export const getPurchaseOrder = (
  apiClient: ApiClient,
  purchaseOrderId: string,
): Promise<PurchaseOrder> => apiClient.get(`/supply/purchase-orders/${purchaseOrderId}`);

export const listSuppliers = (apiClient: ApiClient): Promise<Supplier[]> =>
  apiClient.get("/supply/suppliers");

export const getSupplier = (
  apiClient: ApiClient,
  supplierId: string,
): Promise<Supplier> => apiClient.get(`/supply/suppliers/${supplierId}`);

export const getSupplierPerformance = (
  apiClient: ApiClient,
  supplierId: string,
): Promise<SupplierPerformanceSnapshot> => apiClient.get(`/supply/suppliers/${supplierId}/performance`);

export const listSupplierLeadTimeStats = (
  apiClient: ApiClient,
  supplierId: string,
): Promise<SupplierLeadTimeStat[]> => apiClient.get(`/supply/suppliers/${supplierId}/lead-time-stats`);

export const listSupplierMappingsBySupplier = (
  apiClient: ApiClient,
  supplierId: string,
): Promise<SupplierSku[]> => apiClient.get(`/supply/supplier-skus/by-supplier/${supplierId}`);

export const listSupplierMappingsBySku = (
  apiClient: ApiClient,
  skuId: string,
): Promise<SupplierSku[]> => apiClient.get(`/supply/supplier-skus/by-sku/${skuId}`);

export const listStockoutsForScope = (
  apiClient: ApiClient,
  input: { skuId: string; locationId: string },
): Promise<StockoutIncident[]> =>
  apiClient.get(
    `/outcomes/stockouts${buildQueryString({
      skuId: input.skuId,
      locationId: input.locationId,
    })}`,
  );
