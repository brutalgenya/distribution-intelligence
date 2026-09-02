import type { ApiClient } from "../../lib/api/types";
import type {
  AnomalyScore,
  DecisionOutcome,
  FillRateMeasurement,
  ForecastErrorMeasurement,
  InventoryPosition,
  Location,
  PolicyEffectivenessSummary,
  Sku,
  StockoutIncident,
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

export const listInventoryPositions = (apiClient: ApiClient): Promise<InventoryPosition[]> =>
  apiClient.get("/inventory/positions");

export const listStockoutIncidents = (apiClient: ApiClient): Promise<StockoutIncident[]> =>
  apiClient.get("/outcomes/stockouts");

export const listAnomalyScores = (apiClient: ApiClient): Promise<AnomalyScore[]> =>
  apiClient.get("/ai/anomalies");

export const listFillRateMeasurements = (apiClient: ApiClient): Promise<FillRateMeasurement[]> =>
  apiClient.get("/outcomes/fill-rate");

export const listForecastErrorMeasurements = (
  apiClient: ApiClient,
): Promise<ForecastErrorMeasurement[]> => apiClient.get("/outcomes/forecast-error");

export const listDecisionOutcomes = (apiClient: ApiClient): Promise<DecisionOutcome[]> =>
  apiClient.get(
    `/outcomes/decisions${buildQueryString({
      outcomeStatus: "computed",
    })}`,
  );

export const listPolicyEffectivenessSummaries = (
  apiClient: ApiClient,
): Promise<PolicyEffectivenessSummary[]> => apiClient.get("/outcomes/policies");
