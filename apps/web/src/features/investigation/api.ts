import type { ApiClient } from "../../lib/api/types";
import type { Decision } from "../decisions/types";
import type {
  AnomalyScore,
  DecisionOutcome,
  FillRateMeasurement,
  ForecastErrorMeasurement,
  InventoryPosition,
  Location,
  Sku,
  StockoutIncident,
} from "../outcomes/types";
import type { SupportExecutionTask } from "../workflow/types";
import type {
  CustomerOrder,
  ForecastJob,
  ForecastResult,
  InvestigationParams,
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
  SupplierLeadTimeStat,
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

export const getSku = (apiClient: ApiClient, skuId: string): Promise<Sku> =>
  apiClient.get(`/catalog/skus/${skuId}`);

export const listLocations = (apiClient: ApiClient): Promise<Location[]> =>
  apiClient.get("/inventory/locations");

export const listInventoryPositions = (
  apiClient: ApiClient,
  params: InvestigationParams,
): Promise<InventoryPosition[]> =>
  apiClient.get(
    `/inventory/positions${buildQueryString({
      skuId: params.skuId,
      locationId: params.locationId,
    })}`,
  );

export const listCustomerOrders = (apiClient: ApiClient): Promise<CustomerOrder[]> =>
  apiClient.get("/demand/orders");

export const listForecastJobs = (apiClient: ApiClient): Promise<ForecastJob[]> =>
  apiClient.get(
    `/forecasting/jobs${buildQueryString({
      status: "completed",
    })}`,
  );

export const listForecastResults = (
  apiClient: ApiClient,
  forecastJobId: string,
): Promise<ForecastResult[]> => apiClient.get(`/forecasting/jobs/${forecastJobId}/results`);

export const listSupplierMappingsBySku = (
  apiClient: ApiClient,
  skuId: string,
): Promise<SupplierSku[]> => apiClient.get(`/supply/supplier-skus/by-sku/${skuId}`);

export const getSupplier = (apiClient: ApiClient, supplierId: string): Promise<Supplier> =>
  apiClient.get(`/supply/suppliers/${supplierId}`);

export const listSupplierLeadTimeStats = (
  apiClient: ApiClient,
  supplierId: string,
): Promise<SupplierLeadTimeStat[]> => apiClient.get(`/supply/suppliers/${supplierId}/lead-time-stats`);

export const listPurchaseOrdersByStatus = (
  apiClient: ApiClient,
  status: PurchaseOrderStatus,
): Promise<PurchaseOrder[]> =>
  apiClient.get(
    `/supply/purchase-orders${buildQueryString({
      status,
    })}`,
  );

export const listDecisionsForScope = (
  apiClient: ApiClient,
  params: InvestigationParams,
): Promise<Decision[]> =>
  apiClient.get(
    `/decisioning/decisions${buildQueryString({
      skuId: params.skuId,
      locationId: params.locationId,
    })}`,
  );

export const listExecutionsForDecision = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<SupportExecutionTask[]> =>
  apiClient.get(
    `/support/executions${buildQueryString({
      decisionId,
      limit: "100",
    })}`,
  );

export const listStockoutsForScope = (
  apiClient: ApiClient,
  params: InvestigationParams,
): Promise<StockoutIncident[]> =>
  apiClient.get(
    `/outcomes/stockouts${buildQueryString({
      skuId: params.skuId,
      locationId: params.locationId,
    })}`,
  );

export const listAnomaliesForScope = (
  apiClient: ApiClient,
  params: InvestigationParams,
): Promise<AnomalyScore[]> =>
  apiClient.get(
    `/ai/anomalies${buildQueryString({
      skuId: params.skuId,
      locationId: params.locationId,
    })}`,
  );

export const listFillRateMeasurementsForScope = (
  apiClient: ApiClient,
  params: InvestigationParams,
): Promise<FillRateMeasurement[]> =>
  apiClient.get(
    `/outcomes/fill-rate${buildQueryString({
      skuId: params.skuId,
      locationId: params.locationId,
    })}`,
  );

export const listForecastErrorMeasurementsForScope = (
  apiClient: ApiClient,
  params: InvestigationParams,
): Promise<ForecastErrorMeasurement[]> =>
  apiClient.get(
    `/outcomes/forecast-error${buildQueryString({
      skuId: params.skuId,
      locationId: params.locationId,
    })}`,
  );

export const listDecisionOutcomesByDecision = (
  apiClient: ApiClient,
  decisionId: string,
): Promise<DecisionOutcome[]> => apiClient.get(`/outcomes/decisions/by-decision/${decisionId}`);
