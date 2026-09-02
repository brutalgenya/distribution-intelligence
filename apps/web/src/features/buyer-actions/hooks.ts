import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../lib/api/client";
import { investigationKeys } from "../investigation/query-keys";
import { outcomesDashboardKeys } from "../outcomes/query-keys";
import { useSession } from "../session/SessionProvider";
import { supplyExecutionKeys } from "../supply-execution/query-keys";
import { supportActionsKeys } from "../support-actions/query-keys";
import { workflowQueueKeys } from "../workflow/query-keys";
import {
  delayPurchaseOrder,
  getPurchaseOrder,
  getSupplier,
  getSupplierPerformance,
  listLocations,
  listPurchaseOrders,
  listSkus,
  listSupplierLeadTimeStats,
  listSuppliers,
  receivePurchaseOrder,
  submitPurchaseOrder,
} from "./api";
import { buyerActionsKeys } from "./query-keys";
import type {
  DelayPurchaseOrderInput,
  PurchaseOrderStatus,
  ReceivePurchaseOrderInput,
} from "./types";

const useConfiguredSession = () => {
  const session = useSession();

  return {
    ...session,
    queryEnabled: session.isConfigured,
  };
};

const invalidateOperationalQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  const queryKeys = [
    buyerActionsKeys.all,
    supplyExecutionKeys.all,
    investigationKeys.all,
    outcomesDashboardKeys.all,
    supportActionsKeys.all,
    workflowQueueKeys.all,
  ] as const;

  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
  );
};

export const useBuyerActionsSkus = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: buyerActionsKeys.skus(session.userId, session.organizationId),
    queryFn: () => listSkus(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useBuyerActionsLocations = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: buyerActionsKeys.locations(session.userId, session.organizationId),
    queryFn: () => listLocations(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useBuyerActionsPurchaseOrders = (
  filters: { status?: PurchaseOrderStatus | "all"; supplierId?: string | null } = {},
) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: buyerActionsKeys.purchaseOrders(session.userId, session.organizationId, filters),
    queryFn: () => listPurchaseOrders(apiClient, filters),
    enabled: session.queryEnabled,
  });
};

export const useBuyerActionsPurchaseOrderDetail = (purchaseOrderId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      purchaseOrderId === null
        ? buyerActionsKeys.purchaseOrderDetail(session.userId, session.organizationId, "unselected")
        : buyerActionsKeys.purchaseOrderDetail(session.userId, session.organizationId, purchaseOrderId),
    queryFn: () => getPurchaseOrder(apiClient, purchaseOrderId as string),
    enabled: session.queryEnabled && purchaseOrderId !== null,
  });
};

export const useBuyerActionsSuppliers = () => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey: buyerActionsKeys.suppliers(session.userId, session.organizationId),
    queryFn: () => listSuppliers(apiClient),
    enabled: session.queryEnabled,
    staleTime: 60_000,
  });
};

export const useBuyerActionsSupplierDetail = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? buyerActionsKeys.supplierDetail(session.userId, session.organizationId, "unselected")
        : buyerActionsKeys.supplierDetail(session.userId, session.organizationId, supplierId),
    queryFn: () => getSupplier(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useBuyerActionsSupplierPerformance = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? buyerActionsKeys.supplierPerformance(session.userId, session.organizationId, "unselected")
        : buyerActionsKeys.supplierPerformance(session.userId, session.organizationId, supplierId),
    queryFn: () => getSupplierPerformance(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useBuyerActionsSupplierLeadTimes = (supplierId: string | null) => {
  const apiClient = useApiClient();
  const session = useConfiguredSession();

  return useQuery({
    queryKey:
      supplierId === null
        ? buyerActionsKeys.supplierLeadTimes(session.userId, session.organizationId, "unselected")
        : buyerActionsKeys.supplierLeadTimes(session.userId, session.organizationId, supplierId),
    queryFn: () => listSupplierLeadTimeStats(apiClient, supplierId as string),
    enabled: session.queryEnabled && supplierId !== null,
  });
};

export const useSubmitPurchaseOrderMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { purchaseOrderId: string }) =>
      submitPurchaseOrder(apiClient, input.purchaseOrderId),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useDelayPurchaseOrderMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { purchaseOrderId: string; values: DelayPurchaseOrderInput }) =>
      delayPurchaseOrder(apiClient, input.purchaseOrderId, input.values),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};

export const useReceivePurchaseOrderMutation = () => {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { purchaseOrderId: string; values: ReceivePurchaseOrderInput }) =>
      receivePurchaseOrder(apiClient, input.purchaseOrderId, input.values),
    onSuccess: async () => {
      await invalidateOperationalQueries(queryClient);
    },
  });
};
