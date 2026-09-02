import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  listAnomalyScores,
  listDecisionOutcomes,
  listFillRateMeasurements,
  listForecastErrorMeasurements,
  listInventoryPositions,
  listLocations,
  listPolicyEffectivenessSummaries,
  listSkus,
  listStockoutIncidents,
} from "./api";
import { outcomesDashboardKeys } from "./query-keys";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

export const useCatalogSkus = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.skus(session.userId, session.organizationId),
    queryFn: () => listSkus(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useLocations = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.locations(session.userId, session.organizationId),
    queryFn: () => listLocations(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useInventoryPositions = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.inventoryPositions(session.userId, session.organizationId),
    queryFn: () => listInventoryPositions(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useStockoutIncidents = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.stockouts(session.userId, session.organizationId),
    queryFn: () => listStockoutIncidents(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useAnomalyScores = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.anomalies(session.userId, session.organizationId),
    queryFn: () => listAnomalyScores(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useFillRateMeasurements = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.fillRate(session.userId, session.organizationId),
    queryFn: () => listFillRateMeasurements(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useForecastErrorMeasurements = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.forecastError(session.userId, session.organizationId),
    queryFn: () => listForecastErrorMeasurements(apiClient),
    enabled: session.queryEnabled,
  });
};

export const useDecisionOutcomes = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.decisionOutcomes(session.userId, session.organizationId),
    queryFn: () => listDecisionOutcomes(apiClient),
    enabled: session.queryEnabled,
  });
};

export const usePolicyEffectivenessSummaries = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: outcomesDashboardKeys.policySummaries(session.userId, session.organizationId),
    queryFn: () => listPolicyEffectivenessSummaries(apiClient),
    enabled: session.queryEnabled,
  });
};
