import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { ClosureSignalsSection } from "../components/ClosureSignalsSection";
import { PurchaseOrderDetailPanel } from "../components/PurchaseOrderDetailPanel";
import { PurchaseOrderQueueSection } from "../components/PurchaseOrderQueueSection";
import {
  SupplyExecutionEmptyState,
  SupplyExecutionErrorNotice,
  SupplyExecutionSectionSkeleton,
} from "../components/SupplyExecutionStates";
import { SupplyExecutionSummarySection } from "../components/SupplyExecutionSummarySection";
import { SupplierCoverageSection } from "../components/SupplierCoverageSection";
import {
  useSupplyExecutionLocations,
  useSupplyExecutionMappingsBySku,
  useSupplyExecutionMappingsBySupplier,
  useSupplyExecutionPurchaseOrderDetail,
  useSupplyExecutionPurchaseOrders,
  useSupplyExecutionSkus,
  useSupplyExecutionStockouts,
  useSupplyExecutionSupplierDetail,
  useSupplyExecutionSupplierLeadTimes,
  useSupplyExecutionSupplierPerformance,
  useSupplyExecutionSuppliers,
} from "../hooks";
import { readSupplyExecutionRouteParams } from "../route";
import {
  buildSupplyExecutionContextSummary,
  deriveFocusedSupplierId,
  derivePurchaseOrderQueueRows,
  deriveSupplierCoverageRows,
  deriveSupplyFreshness,
  deriveSupplySummaryCards,
} from "../selectors";
import type { SupplyExecutionFilters, SupplyExecutionRouteParams } from "../types";

const knownParams = [
  "purchaseOrderId",
  "supplierId",
  "skuId",
  "locationId",
  "status",
  "search",
] as const;

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const SupplyExecutionPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useMemo(() => readSupplyExecutionRouteParams(searchParams), [searchParams]);

  const purchaseOrdersQuery = useSupplyExecutionPurchaseOrders({
    status: routeParams.status,
    supplierId: routeParams.supplierId,
  });
  const purchaseOrderDetailQuery = useSupplyExecutionPurchaseOrderDetail(routeParams.purchaseOrderId);
  const suppliersQuery = useSupplyExecutionSuppliers();
  const skusQuery = useSupplyExecutionSkus();
  const locationsQuery = useSupplyExecutionLocations();

  const purchaseOrders = purchaseOrdersQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const skus = skusQuery.data ?? [];
  const locations = locationsQuery.data ?? [];

  const selectedPurchaseOrder =
    purchaseOrderDetailQuery.data ??
    purchaseOrders.find((purchaseOrder) => purchaseOrder.id === routeParams.purchaseOrderId) ??
    null;

  const focusedSupplierId = deriveFocusedSupplierId({
    explicitSupplierId: routeParams.supplierId,
    selectedPurchaseOrder,
  });

  const supplierDetailQuery = useSupplyExecutionSupplierDetail(focusedSupplierId);
  const supplierPerformanceQuery = useSupplyExecutionSupplierPerformance(focusedSupplierId);
  const supplierLeadTimesQuery = useSupplyExecutionSupplierLeadTimes(focusedSupplierId);
  const supplierMappingsBySupplierQuery = useSupplyExecutionMappingsBySupplier(focusedSupplierId);
  const supplierMappingsBySkuQuery = useSupplyExecutionMappingsBySku(routeParams.skuId);
  const stockoutsQuery = useSupplyExecutionStockouts({
    skuId: routeParams.skuId,
    locationId: routeParams.locationId,
  });

  const focusedSupplier =
    supplierDetailQuery.data ?? suppliers.find((supplier) => supplier.id === focusedSupplierId) ?? null;
  const stockouts = stockoutsQuery.data ?? [];
  const focusedMappings =
    supplierMappingsBySupplierQuery.data ??
    (focusedSupplierId === null ? supplierMappingsBySkuQuery.data ?? [] : []);

  const filters: SupplyExecutionFilters = useMemo(
    () => ({
      status: routeParams.status,
      supplierId: routeParams.supplierId,
      search: routeParams.search,
    }),
    [routeParams.search, routeParams.status, routeParams.supplierId],
  );

  const queueRows = useMemo(
    () =>
      derivePurchaseOrderQueueRows({
        purchaseOrders,
        suppliers,
        filters,
        context: {
          skuId: routeParams.skuId,
          locationId: routeParams.locationId,
        },
      }),
    [filters, purchaseOrders, routeParams.locationId, routeParams.skuId, suppliers],
  );

  const summaryCards = useMemo(
    () =>
      deriveSupplySummaryCards({
        queueRows,
        selectedSupplierPerformance: supplierPerformanceQuery.data ?? null,
      }),
    [queueRows, supplierPerformanceQuery.data],
  );

  const supplierCoverageRows = useMemo(
    () =>
      deriveSupplierCoverageRows({
        suppliers,
        queueRows,
      }),
    [queueRows, suppliers],
  );

  const freshnessAt = useMemo(
    () =>
      deriveSupplyFreshness({
        purchaseOrders,
        selectedSupplierPerformance: supplierPerformanceQuery.data ?? null,
        stockouts,
      }),
    [purchaseOrders, stockouts, supplierPerformanceQuery.data],
  );

  const contextSummary = useMemo(
    () =>
      buildSupplyExecutionContextSummary({
        skuId: routeParams.skuId,
        locationId: routeParams.locationId,
        skus,
        locations,
        stockouts,
      }),
    [locations, routeParams.locationId, routeParams.skuId, skus, stockouts],
  );

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  };

  const applyRouteParams = (nextParams: Partial<SupplyExecutionRouteParams>) => {
    updateParams((params) => {
      const mergedParams: SupplyExecutionRouteParams = {
        purchaseOrderId: routeParams.purchaseOrderId,
        supplierId: routeParams.supplierId,
        skuId: routeParams.skuId,
        locationId: routeParams.locationId,
        status: routeParams.status,
        search: routeParams.search,
        ...nextParams,
      };

      knownParams.forEach((key) => {
        params.delete(key);
      });

      if (mergedParams.purchaseOrderId) {
        params.set("purchaseOrderId", mergedParams.purchaseOrderId);
      }
      if (mergedParams.supplierId) {
        params.set("supplierId", mergedParams.supplierId);
      }
      if (mergedParams.skuId) {
        params.set("skuId", mergedParams.skuId);
      }
      if (mergedParams.locationId) {
        params.set("locationId", mergedParams.locationId);
      }
      if (mergedParams.status !== "all") {
        params.set("status", mergedParams.status);
      }
      if (mergedParams.search.trim().length > 0) {
        params.set("search", mergedParams.search.trim());
      }
    });
  };

  if (!session.isConfigured) {
    return (
      <SupplyExecutionEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real backend."
      />
    );
  }

  const initialLoading =
    purchaseOrdersQuery.isLoading &&
    suppliersQuery.isLoading &&
    skusQuery.isLoading &&
    locationsQuery.isLoading;

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Supply Execution"
        title="Purchase order execution and supplier coverage"
        description="Track replenishment through the real purchase-order queue, supplier context, and closure evidence so execution decisions stay grounded in operational facts."
        meta={
          <div className="flex flex-wrap gap-2">
            <StatusChip tone={queueRows.length > 0 ? "info" : "neutral"}>
              {queueRows.length} queued purchase orders
            </StatusChip>
              <StatusChip tone={focusedSupplier ? "info" : "neutral"}>
                {supplierCoverageRows.length} supplier coverage views
              </StatusChip>
            <StatusChip tone={stockouts.length > 0 ? "danger" : "neutral"}>
              {stockouts.length} scoped stockouts
            </StatusChip>
          </div>
        }
      />

      {initialLoading ? (
        <SupplyExecutionSectionSkeleton rows={5} />
      ) : (
        <SupplyExecutionSummarySection
          cards={summaryCards}
          freshnessAt={freshnessAt}
          contextSummary={contextSummary}
        />
      )}

      {purchaseOrdersQuery.isError || suppliersQuery.isError || skusQuery.isError || locationsQuery.isError ? (
        <SupplyExecutionErrorNotice
          title="Some supply execution inputs could not be loaded"
          message={getApiErrorMessage(
            purchaseOrdersQuery.error ??
              suppliersQuery.error ??
              skusQuery.error ??
              locationsQuery.error,
            "One or more supply execution queries failed.",
          )}
        />
      ) : null}

      <SplitPanel
        collapseAt="2xl"
        secondarySticky={false}
        primary={
          <div className="space-y-6">
            {purchaseOrdersQuery.isLoading && queueRows.length === 0 ? (
              <SupplyExecutionSectionSkeleton rows={5} />
            ) : (
              <PurchaseOrderQueueSection
                rows={queueRows}
                suppliers={suppliers}
                filters={filters}
                selectedPurchaseOrderId={routeParams.purchaseOrderId}
                context={{
                  skuId: routeParams.skuId,
                  locationId: routeParams.locationId,
                }}
                onFiltersChange={(nextFilters) =>
                  applyRouteParams({
                    status: nextFilters.status,
                    supplierId: nextFilters.supplierId,
                    search: nextFilters.search,
                    purchaseOrderId: null,
                  })
                }
                onSelectPurchaseOrder={(purchaseOrderId) =>
                  applyRouteParams({
                    purchaseOrderId,
                  })
                }
              />
            )}

            {stockoutsQuery.isError ? (
              <SupplyExecutionErrorNotice
                title="Closure evidence unavailable"
                message={getApiErrorMessage(
                  stockoutsQuery.error,
                  "Item-level stockout evidence could not be loaded for the current scope.",
                )}
              />
            ) : (
              <ClosureSignalsSection
                selectedPurchaseOrder={selectedPurchaseOrder}
                stockouts={stockouts}
                skuId={routeParams.skuId}
                locationId={routeParams.locationId}
              />
            )}
          </div>
        }
        secondary={
          <div className="space-y-6">
            {purchaseOrderDetailQuery.isLoading && selectedPurchaseOrder === null ? (
              <SupplyExecutionSectionSkeleton rows={4} />
            ) : purchaseOrderDetailQuery.isError ? (
              <SupplyExecutionErrorNotice
                title="Purchase order detail unavailable"
                message={getApiErrorMessage(
                  purchaseOrderDetailQuery.error,
                  "The selected purchase order could not be loaded.",
                )}
              />
            ) : (
              <PurchaseOrderDetailPanel
                purchaseOrder={selectedPurchaseOrder}
                supplier={focusedSupplier}
                supplierPerformance={supplierPerformanceQuery.data ?? null}
                skus={skus}
                locations={locations}
              />
            )}

            {supplierDetailQuery.isLoading && focusedSupplierId !== null && focusedSupplier === null ? (
              <SupplyExecutionSectionSkeleton rows={4} />
            ) : supplierDetailQuery.isError || supplierPerformanceQuery.isError || supplierLeadTimesQuery.isError ? (
              <SupplyExecutionErrorNotice
                title="Supplier context unavailable"
                message={getApiErrorMessage(
                  supplierDetailQuery.error ??
                    supplierPerformanceQuery.error ??
                    supplierLeadTimesQuery.error,
                  "The focused supplier context could not be loaded.",
                )}
              />
            ) : (
              <SupplierCoverageSection
                focusedSupplier={focusedSupplier}
                focusedSupplierPerformance={supplierPerformanceQuery.data ?? null}
                focusedSupplierLeadTimes={supplierLeadTimesQuery.data ?? []}
                focusedMappings={focusedMappings}
                supplierCoverageRows={supplierCoverageRows}
              />
            )}
          </div>
        }
      />
    </div>
  );
};
