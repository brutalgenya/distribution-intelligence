import type { ApiClient } from "../../lib/api/types";
import type {
  DelayPurchaseOrderInput,
  Location,
  PurchaseOrder,
  PurchaseOrderStatus,
  ReceivePurchaseOrderInput,
  Sku,
  Supplier,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
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

export const listSkus = (apiClient: ApiClient): Promise<Sku[]> =>
  apiClient.get("/catalog/skus");

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
): Promise<SupplierPerformanceSnapshot> =>
  apiClient.get(`/supply/suppliers/${supplierId}/performance`);

export const listSupplierLeadTimeStats = (
  apiClient: ApiClient,
  supplierId: string,
): Promise<SupplierLeadTimeStat[]> =>
  apiClient.get(`/supply/suppliers/${supplierId}/lead-time-stats`);

export const submitPurchaseOrder = (
  apiClient: ApiClient,
  purchaseOrderId: string,
): Promise<PurchaseOrder> => apiClient.post(`/supply/purchase-orders/${purchaseOrderId}/submit`);

export const delayPurchaseOrder = (
  apiClient: ApiClient,
  purchaseOrderId: string,
  input: DelayPurchaseOrderInput,
): Promise<PurchaseOrder> =>
  apiClient.post(`/supply/purchase-orders/${purchaseOrderId}/delay`, input);

export const receivePurchaseOrder = (
  apiClient: ApiClient,
  purchaseOrderId: string,
  input: ReceivePurchaseOrderInput,
): Promise<PurchaseOrder> =>
  apiClient.post(`/supply/purchase-orders/${purchaseOrderId}/receive`, input);
