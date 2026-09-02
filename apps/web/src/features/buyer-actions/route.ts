import type {
  BuyerActionsRouteParams,
  BuyerActionType,
  PurchaseOrderStatus,
} from "./types";

const purchaseOrderStatuses = new Set<PurchaseOrderStatus>([
  "draft",
  "submitted",
  "partially_received",
  "received",
  "delayed",
  "cancelled",
]);

const buyerActionTypes = new Set<BuyerActionType>(["submit", "delay", "receive"]);

const readStatus = (value: string | null): PurchaseOrderStatus | "all" => {
  if (value === "all" || value === null) {
    return "all";
  }

  return purchaseOrderStatuses.has(value as PurchaseOrderStatus)
    ? (value as PurchaseOrderStatus)
    : "all";
};

const readAction = (value: string | null): BuyerActionType | "all" => {
  if (value === "all" || value === null) {
    return "all";
  }

  return buyerActionTypes.has(value as BuyerActionType) ? (value as BuyerActionType) : "all";
};

export const buildBuyerActionsHref = (
  params: Partial<BuyerActionsRouteParams> = {},
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

  if (params.action && params.action !== "all") {
    searchParams.set("action", params.action);
  }

  if (params.search && params.search.trim().length > 0) {
    searchParams.set("search", params.search.trim());
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/buyer-actions?${queryString}` : "/buyer-actions";
};

export const readBuyerActionsRouteParams = (
  searchParams: URLSearchParams,
): BuyerActionsRouteParams => ({
  purchaseOrderId: searchParams.get("purchaseOrderId"),
  supplierId: searchParams.get("supplierId"),
  skuId: searchParams.get("skuId"),
  locationId: searchParams.get("locationId"),
  status: readStatus(searchParams.get("status")),
  action: readAction(searchParams.get("action")),
  search: searchParams.get("search") ?? "",
});
