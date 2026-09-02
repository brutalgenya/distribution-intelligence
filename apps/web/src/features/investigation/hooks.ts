import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  getSku,
  getSupplier,
  listAnomaliesForScope,
  listCustomerOrders,
  listDecisionOutcomesByDecision,
  listDecisionsForScope,
  listExecutionsForDecision,
  listFillRateMeasurementsForScope,
  listForecastErrorMeasurementsForScope,
  listForecastJobs,
  listForecastResults,
  listInventoryPositions,
  listLocations,
  listPurchaseOrdersByStatus,
  listStockoutsForScope,
  listSupplierLeadTimeStats,
  listSupplierMappingsBySku,
} from "./api";
import { investigationKeys } from "./query-keys";
import {
  isRelevantForecastJob,
  matchCustomerOrders,
  matchPurchaseOrders,
  selectRelevantForecastResults,
} from "./selectors";
import type { InvestigationParams } from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const isUuid = (value: string | null): value is string =>
  value !== null &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const unselectedParams: InvestigationParams = {
  skuId: "unselected",
  locationId: "unselected",
};

export const useInvestigationParams = (): InvestigationParams | null => {
  const [searchParams] = useSearchParams();
  const skuId = searchParams.get("skuId");
  const locationId = searchParams.get("locationId");

  if (!isUuid(skuId) || !isUuid(locationId)) {
    return null;
  }

  return {
    skuId,
    locationId,
  };
};

export const useInvestigationContext = (params: InvestigationParams | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      params === null
        ? investigationKeys.context(session.userId, session.organizationId, unselectedParams)
        : investigationKeys.context(session.userId, session.organizationId, params),
    queryFn: async () => {
      const activeParams = params as InvestigationParams;
      const [sku, locations, positions] = await Promise.all([
        getSku(apiClient, activeParams.skuId),
        listLocations(apiClient),
        listInventoryPositions(apiClient, activeParams),
      ]);

      return {
        sku,
        location: locations.find((location) => location.id === activeParams.locationId) ?? null,
        position: positions[0] ?? null,
      };
    },
    enabled: session.queryEnabled && params !== null,
    staleTime: 60_000,
  });
};

export const useInvestigationSignals = (params: InvestigationParams | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      params === null
        ? investigationKeys.signals(session.userId, session.organizationId, unselectedParams)
        : investigationKeys.signals(session.userId, session.organizationId, params),
    queryFn: async () => {
      const activeParams = params as InvestigationParams;
      const [stockouts, anomalies, fillRates, forecastErrors] = await Promise.all([
        listStockoutsForScope(apiClient, activeParams),
        listAnomaliesForScope(apiClient, activeParams),
        listFillRateMeasurementsForScope(apiClient, activeParams),
        listForecastErrorMeasurementsForScope(apiClient, activeParams),
      ]);

      return {
        stockouts: stockouts.sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        ),
        anomalies: anomalies.sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        ),
        fillRates: fillRates.sort(
          (left, right) =>
            new Date(right.measurementWindowEnd).getTime() -
            new Date(left.measurementWindowEnd).getTime(),
        ),
        forecastErrors: forecastErrors.sort(
          (left, right) =>
            new Date(right.measurementWindowEnd).getTime() -
            new Date(left.measurementWindowEnd).getTime(),
        ),
      };
    },
    enabled: session.queryEnabled && params !== null,
  });
};

export const useInvestigationForecastDemand = (params: InvestigationParams | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      params === null
        ? investigationKeys.forecastDemand(session.userId, session.organizationId, unselectedParams)
        : investigationKeys.forecastDemand(session.userId, session.organizationId, params),
    queryFn: async () => {
      const activeParams = params as InvestigationParams;
      const [forecastJobs, customerOrders] = await Promise.all([
        listForecastJobs(apiClient),
        listCustomerOrders(apiClient),
      ]);

      const relevantJobs = forecastJobs
        .filter((job) => isRelevantForecastJob(job, activeParams))
        .sort((left, right) => {
          const rightTimestamp = right.completedAt ?? right.createdAt;
          const leftTimestamp = left.completedAt ?? left.createdAt;
          return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
        })
        .slice(0, 3);

      const forecastSnapshots = await Promise.all(
        relevantJobs.map(async (job) => {
          const results = await listForecastResults(apiClient, job.id);

          return {
            job,
            results: selectRelevantForecastResults(results, activeParams),
          };
        }),
      );

      return {
        recentOrders: matchCustomerOrders(customerOrders, activeParams),
        forecastSnapshots: forecastSnapshots.filter((snapshot) => snapshot.results.length > 0),
      };
    },
    enabled: session.queryEnabled && params !== null,
  });
};

export const useInvestigationSupply = (params: InvestigationParams | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      params === null
        ? investigationKeys.supply(session.userId, session.organizationId, unselectedParams)
        : investigationKeys.supply(session.userId, session.organizationId, params),
    queryFn: async () => {
      const activeParams = params as InvestigationParams;
      const mappings = await listSupplierMappingsBySku(apiClient, activeParams.skuId);
      const supplierIds = [...new Set(mappings.map((mapping) => mapping.supplierId))];

      const [suppliers, leadTimeStatLists, submitted, partiallyReceived, delayed] = await Promise.all([
        Promise.all(supplierIds.map((supplierId) => getSupplier(apiClient, supplierId))),
        Promise.all(supplierIds.map((supplierId) => listSupplierLeadTimeStats(apiClient, supplierId))),
        listPurchaseOrdersByStatus(apiClient, "submitted"),
        listPurchaseOrdersByStatus(apiClient, "partially_received"),
        listPurchaseOrdersByStatus(apiClient, "delayed"),
      ]);

      return {
        mappings,
        suppliers,
        leadTimeStats: leadTimeStatLists.flat().filter((stat) => stat.skuId === activeParams.skuId),
        openPurchaseOrders: matchPurchaseOrders(
          [...submitted, ...partiallyReceived, ...delayed],
          activeParams,
        ),
      };
    },
    enabled: session.queryEnabled && params !== null,
  });
};

export const useInvestigationDecisions = (params: InvestigationParams | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      params === null
        ? investigationKeys.decisions(session.userId, session.organizationId, unselectedParams)
        : investigationKeys.decisions(session.userId, session.organizationId, params),
    queryFn: async () => {
      const decisions = await listDecisionsForScope(apiClient, params as InvestigationParams);

      const decisionBundles = await Promise.all(
        decisions.map(async (decision) => {
          const [executions, outcomes] = await Promise.all([
            listExecutionsForDecision(apiClient, decision.id),
            listDecisionOutcomesByDecision(apiClient, decision.id),
          ]);

          return {
            decision,
            executions: executions.sort(
              (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
            ),
            outcomes: outcomes.sort(
              (left, right) =>
                new Date(right.measurementWindowEnd).getTime() -
                new Date(left.measurementWindowEnd).getTime(),
            ),
          };
        }),
      );

      return {
        decisions: decisionBundles.sort(
          (left, right) =>
            new Date(right.decision.updatedAt).getTime() -
            new Date(left.decision.updatedAt).getTime(),
        ),
      };
    },
    enabled: session.queryEnabled && params !== null,
  });
};
