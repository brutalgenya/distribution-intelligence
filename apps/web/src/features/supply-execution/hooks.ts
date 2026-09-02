import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { useSession } from "../session/SessionProvider";
import {
  getPurchaseOrder,
  getSupplier,
  getSupplierPerformance,
  listLocations,
  listPurchaseOrders,
  listSkus,
  listStockoutsForScope,
  listSupplierLeadTimeStats,
  listSupplierMappingsBySku,
  listSupplierMappingsBySupplier,
  listSuppliers,
} from "./api";
import { supplyExecutionKeys } from "./query-keys";
import type { PurchaseOrderStatus } from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

export const useSupplyExecutionSkus = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supplyExecutionKeys.skus(session.userId, session.organizationId),
    queryFn: () => listSkus(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useSupplyExecutionLocations = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supplyExecutionKeys.locations(session.userId, session.organizationId),
    queryFn: () => listLocations(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useSupplyExecutionPurchaseOrders = (
  filters: { status?: PurchaseOrderStatus | "all"; supplierId?: string | null } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supplyExecutionKeys.purchaseOrders(session.userId, session.organizationId, filters),
    queryFn: () => listPurchaseOrders(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useSupplyExecutionPurchaseOrderDetail = (purchaseOrderId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      purchaseOrderId === null
        ? supplyExecutionKeys.purchaseOrderDetail(session.userId, session.organizationId, "unselected")
        : supplyExecutionKeys.purchaseOrderDetail(session.userId, session.organizationId, purchaseOrderId),
    queryFn: () => getPurchaseOrder(apiClient, purchaseOrderId as string),
    enabled: session.queryEnabled && purchaseOrderId !== null,
  });
};

export const useSupplyExecutionSuppliers = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: supplyExecutionKeys.suppliers(session.userId, session.organizationId),
    queryFn: () => listSuppliers(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useSupplyExecutionSupplierDetail = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? supplyExecutionKeys.supplierDetail(session.userId, session.organizationId, "unselected")
        : supplyExecutionKeys.supplierDetail(session.userId, session.organizationId, supplierId),
    queryFn: () => getSupplier(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useSupplyExecutionSupplierPerformance = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? supplyExecutionKeys.supplierPerformance(session.userId, session.organizationId, "unselected")
        : supplyExecutionKeys.supplierPerformance(session.userId, session.organizationId, supplierId),
    queryFn: () => getSupplierPerformance(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useSupplyExecutionSupplierLeadTimes = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? supplyExecutionKeys.supplierLeadTimes(session.userId, session.organizationId, "unselected")
        : supplyExecutionKeys.supplierLeadTimes(session.userId, session.organizationId, supplierId),
    queryFn: () => listSupplierLeadTimeStats(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useSupplyExecutionMappingsBySupplier = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? supplyExecutionKeys.supplierMappingsBySupplier(session.userId, session.organizationId, "unselected")
        : supplyExecutionKeys.supplierMappingsBySupplier(session.userId, session.organizationId, supplierId),
    queryFn: () => listSupplierMappingsBySupplier(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useSupplyExecutionMappingsBySku = (skuId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      skuId === null
        ? supplyExecutionKeys.supplierMappingsBySku(session.userId, session.organizationId, "unselected")
        : supplyExecutionKeys.supplierMappingsBySku(session.userId, session.organizationId, skuId),
    queryFn: () => listSupplierMappingsBySku(apiClient, skuId as string),
    enabled: session.queryEnabled && skuId !== null,
  });
};

export const useSupplyExecutionStockouts = (input: { skuId: string | null; locationId: string | null }) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();
  const enabled = session.queryEnabled && input.skuId !== null && input.locationId !== null;

  return useQuery({
    queryKey:
      enabled && input.skuId && input.locationId
        ? supplyExecutionKeys.stockouts(session.userId, session.organizationId, {
            skuId: input.skuId,
            locationId: input.locationId,
          })
        : supplyExecutionKeys.stockouts(session.userId, session.organizationId, {
            skuId: "unselected",
            locationId: "unselected",
          }),
    queryFn: () =>
      listStockoutsForScope(apiClient, {
        skuId: input.skuId as string,
        locationId: input.locationId as string,
      }),
    enabled,
  });
};
