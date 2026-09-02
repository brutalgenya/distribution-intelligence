import type { PurchaseOrderStatus } from "./types";
import type { SupplyExecutionRouteParams } from "./types";

const purchaseOrderStatuses = new Set<PurchaseOrderStatus>([
  "draft",
  "submitted",
  "partially_received",
  "received",
  "delayed",
  "cancelled",
]);

const readStatus = (value: string | null): PurchaseOrderStatus | "all" => {
  if (value === "all" || value === null) {
    return "all";
  }

  return purchaseOrderStatuses.has(value as PurchaseOrderStatus) ? (value as PurchaseOrderStatus) : "all";
};

export const buildSupplyExecutionHref = (
  params: Partial<SupplyExecutionRouteParams> = {},
): string => {
  const searchParams = new URLSearchParams();

  if (params.purchaseOrderId) {
    searchParams.set("purchaseOrderId", params.purchaseOrderId);
  }

  if (params.supplierId) {
    searchParams.set("supplierId", params.supplierId);
  }

  if (params.skuId) {
    searchParams.set("skuId", params.skuId);
  }

  if (params.locationId) {
    searchParams.set("locationId", params.locationId);
  }

  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.search && params.search.trim().length > 0) {
    searchParams.set("search", params.search.trim());
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/supply-execution?${queryString}` : "/supply-execution";
};

export const readSupplyExecutionRouteParams = (
  searchParams: URLSearchParams,
): SupplyExecutionRouteParams => ({
  purchaseOrderId: searchParams.get("purchaseOrderId"),
  supplierId: searchParams.get("supplierId"),
  skuId: searchParams.get("skuId"),
  locationId: searchParams.get("locationId"),
  status: readStatus(searchParams.get("status")),
  search: searchParams.get("search") ?? "",
});
