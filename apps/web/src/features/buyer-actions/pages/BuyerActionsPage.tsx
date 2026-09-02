import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { isApiError } from "../../../lib/api/errors";
import { buildInvestigationHref } from "../../investigation/route";
import { buildLocationLookup, buildSkuLookup } from "../../supply-execution/selectors";
import { useSession } from "../../session/SessionProvider";
import { ActionConfirmationDialog } from "../../support-actions/components/ActionConfirmationDialog";
import { ActionablePurchaseOrderQueueSection } from "../components/ActionablePurchaseOrderQueueSection";
import {
  BuyerActionsEmptyState,
  BuyerActionsErrorNotice,
  BuyerActionsSectionSkeleton,
} from "../components/BuyerActionsStates";
import { BuyerActionsSummarySection } from "../components/BuyerActionsSummarySection";
import { OperationalFollowThroughSection } from "../components/OperationalFollowThroughSection";
import { PurchaseOrderActionPanel } from "../components/PurchaseOrderActionPanel";
import { ReceivingSection } from "../components/ReceivingSection";
import { SubmitDelaySection } from "../components/SubmitDelaySection";
import {
  useBuyerActionsLocations,
  useBuyerActionsPurchaseOrderDetail,
  useBuyerActionsPurchaseOrders,
  useBuyerActionsSkus,
  useBuyerActionsSupplierDetail,
  useBuyerActionsSupplierLeadTimes,
  useBuyerActionsSupplierPerformance,
  useBuyerActionsSuppliers,
  useDelayPurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
} from "../hooks";
import { readBuyerActionsRouteParams } from "../route";
import {
  buildBuyerActionMutationSummary,
  deriveBuyerActionsFreshness,
  deriveBuyerActionsQueueRows,
  deriveBuyerActionsSummaryCards,
  deriveFocusedSupplierId,
} from "../selectors";
import type {
  BuyerActionFeedback,
  BuyerActionsFilters,
  BuyerActionsMutationSummary,
  BuyerActionsRouteParams,
  DelayPurchaseOrderInput,
  PurchaseOrder,
  ReceivePurchaseOrderInput,
} from "../types";

type ConfirmationState =
  | { kind: "submit"; purchaseOrder: PurchaseOrder }
  | { kind: "delay"; purchaseOrder: PurchaseOrder; values: DelayPurchaseOrderInput }
  | { kind: "receive"; purchaseOrder: PurchaseOrder; values: ReceivePurchaseOrderInput };

const knownParams = [
  "purchaseOrderId",
  "supplierId",
  "skuId",
  "locationId",
  "status",
  "action",
  "search",
] as const;

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const BuyerActionsPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useMemo(() => readBuyerActionsRouteParams(searchParams), [searchParams]);

  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const [feedback, setFeedback] = useState<BuyerActionFeedback | null>(null);
  const [lastMutationSummary, setLastMutationSummary] = useState<BuyerActionsMutationSummary | null>(null);

  const purchaseOrdersQuery = useBuyerActionsPurchaseOrders({
    status: routeParams.status,
    supplierId: routeParams.supplierId,
  });
  const purchaseOrderDetailQuery = useBuyerActionsPurchaseOrderDetail(routeParams.purchaseOrderId);
  const suppliersQuery = useBuyerActionsSuppliers();
  const skusQuery = useBuyerActionsSkus();
  const locationsQuery = useBuyerActionsLocations();

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

  const supplierDetailQuery = useBuyerActionsSupplierDetail(focusedSupplierId);
  const supplierPerformanceQuery = useBuyerActionsSupplierPerformance(focusedSupplierId);
  const supplierLeadTimesQuery = useBuyerActionsSupplierLeadTimes(focusedSupplierId);

  const submitMutation = useSubmitPurchaseOrderMutation();
  const delayMutation = useDelayPurchaseOrderMutation();
  const receiveMutation = useReceivePurchaseOrderMutation();

  const filters: BuyerActionsFilters = useMemo(
    () => ({
      status: routeParams.status,
      supplierId: routeParams.supplierId,
      action: routeParams.action,
      search: routeParams.search,
    }),
    [routeParams.action, routeParams.search, routeParams.status, routeParams.supplierId],
  );

  const queueRows = useMemo(
    () =>
      deriveBuyerActionsQueueRows({
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
      deriveBuyerActionsSummaryCards({
        queueRows,
        selectedSupplierPerformance: supplierPerformanceQuery.data ?? null,
      }),
    [queueRows, supplierPerformanceQuery.data],
  );

  const freshnessAt = useMemo(
    () =>
      deriveBuyerActionsFreshness({
        purchaseOrders,
        selectedSupplierPerformance: supplierPerformanceQuery.data ?? null,
      }),
    [purchaseOrders, supplierPerformanceQuery.data],
  );

  const scope = useMemo(() => {
    const skuLookup = buildSkuLookup(skus);
    const locationLookup = buildLocationLookup(locations);

    return {
      sku: routeParams.skuId ? skuLookup.get(routeParams.skuId) ?? null : null,
      location: routeParams.locationId ? locationLookup.get(routeParams.locationId) ?? null : null,
    };
  }, [locations, routeParams.locationId, routeParams.skuId, skus]);

  const applyRouteParams = (nextParams: Partial<BuyerActionsRouteParams>) => {
    const mergedParams: BuyerActionsRouteParams = {
      purchaseOrderId: routeParams.purchaseOrderId,
      supplierId: routeParams.supplierId,
      skuId: routeParams.skuId,
      locationId: routeParams.locationId,
      status: routeParams.status,
      action: routeParams.action,
      search: routeParams.search,
      ...nextParams,
    };

    const nextSearchParams = new URLSearchParams(searchParams);
    knownParams.forEach((key) => {
      nextSearchParams.delete(key);
    });

    if (mergedParams.purchaseOrderId) {
      nextSearchParams.set("purchaseOrderId", mergedParams.purchaseOrderId);
    }
    if (mergedParams.supplierId) {
      nextSearchParams.set("supplierId", mergedParams.supplierId);
    }
    if (mergedParams.skuId) {
      nextSearchParams.set("skuId", mergedParams.skuId);
    }
    if (mergedParams.locationId) {
      nextSearchParams.set("locationId", mergedParams.locationId);
    }
    if (mergedParams.status !== "all") {
      nextSearchParams.set("status", mergedParams.status);
    }
    if (mergedParams.action !== "all") {
      nextSearchParams.set("action", mergedParams.action);
    }
    if (mergedParams.search.trim().length > 0) {
      nextSearchParams.set("search", mergedParams.search.trim());
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleMutationSuccess = (action: ConfirmationState["kind"], purchaseOrder: PurchaseOrder) => {
    setFeedback({
      tone: "success",
      title:
        action === "submit"
          ? "Purchase order submitted"
          : action === "delay"
            ? "Purchase order delayed"
            : "Receipt posted",
      message:
        action === "submit"
          ? `Backend status is now ${purchaseOrder.status} for ${purchaseOrder.poNumber}.`
          : action === "delay"
            ? `Backend status is now ${purchaseOrder.status} and expected delivery is ${purchaseOrder.expectedDeliveryAt ?? "not available"}.`
            : `Backend refreshed receipt totals for ${purchaseOrder.poNumber}.`,
    });
    setLastMutationSummary(
      buildBuyerActionMutationSummary({
        action,
        purchaseOrder,
      }),
    );
    applyRouteParams({
      purchaseOrderId: purchaseOrder.id,
      supplierId: purchaseOrder.supplierId,
    });
  };

  const handleMutationError = (title: string, error: unknown, fallback: string) => {
    setFeedback({
      tone: "error",
      title,
      message: getApiErrorMessage(error, fallback),
    });
  };

  const handleConfirm = async (): Promise<void> => {
    if (!confirmationState) {
      return;
    }

    try {
      if (confirmationState.kind === "submit") {
        const result = await submitMutation.mutateAsync({
          purchaseOrderId: confirmationState.purchaseOrder.id,
        });
        handleMutationSuccess("submit", result);
      }

      if (confirmationState.kind === "delay") {
        const result = await delayMutation.mutateAsync({
          purchaseOrderId: confirmationState.purchaseOrder.id,
          values: confirmationState.values,
        });
        handleMutationSuccess("delay", result);
      }

      if (confirmationState.kind === "receive") {
        const result = await receiveMutation.mutateAsync({
          purchaseOrderId: confirmationState.purchaseOrder.id,
          values: confirmationState.values,
        });
        handleMutationSuccess("receive", result);
      }

      setConfirmationState(null);
    } catch (error) {
      handleMutationError(
        confirmationState.kind === "submit"
          ? "Submit failed"
          : confirmationState.kind === "delay"
            ? "Delay transition failed"
            : "Receipt posting failed",
        error,
        confirmationState.kind === "submit"
          ? "The backend rejected the purchase order submit request."
          : confirmationState.kind === "delay"
            ? "The backend rejected the delay transition request."
            : "The backend rejected the receipt posting request.",
      );
    }
  };

  const dialogConfig =
    confirmationState === null
      ? null
      : confirmationState.kind === "submit"
        ? {
            title: "Submit purchase order",
            description:
              "This calls the real purchase-order submit route. The backend owns lifecycle validation and will return the persisted purchase order state.",
            confirmLabel: "Submit purchase order",
          }
        : confirmationState.kind === "delay"
          ? {
              title: "Mark purchase order delayed",
              description:
                "This uses the backend delay route. If you provided an expected delivery timestamp or notes, they will be persisted only as part of this delayed transition.",
              confirmLabel: "Mark delayed",
            }
          : {
              title: "Post receipt",
              description:
                "This posts cumulative receipt quantities through the backend receive route. Inventory movement, status progression, and lead-time recomputation remain server-owned.",
              confirmLabel: "Post receipt",
            };

  const isDialogPending =
    submitMutation.isPending || delayMutation.isPending || receiveMutation.isPending;

  if (!session.isConfigured) {
    return (
      <BuyerActionsEmptyState
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
    <>
      <div className="page-stack">
        <PageIntro
          eyebrow="Buyer Actions"
          title="Buyer-facing purchase order actions"
          description="Move from monitoring into explicit purchase-order transitions and receipt handling while keeping the backend authoritative for lifecycle and inventory outcomes."
          actions={
            <>
              <Link to="/supply-execution" className={uiButtonSecondaryClassName}>
                Open supply execution
              </Link>
              {scope.sku && scope.location ? (
                <Link
                  to={buildInvestigationHref(scope.sku.id, scope.location.id)}
                  className={uiButtonSecondaryClassName}
                >
                  Open investigation
                </Link>
              ) : null}
            </>
          }
          meta={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone={queueRows.length > 0 ? "info" : "neutral"}>
                {queueRows.length} actionable orders
              </StatusChip>
              <StatusChip tone={selectedPurchaseOrder ? "warning" : "neutral"}>
                {selectedPurchaseOrder ? selectedPurchaseOrder.status : "No order selected"}
              </StatusChip>
              <StatusChip tone={summaryCards.some((card) => card.tone === "critical") ? "danger" : "neutral"}>
                {summaryCards.length} operating signals
              </StatusChip>
            </div>
          }
        />

        {initialLoading ? (
          <BuyerActionsSectionSkeleton rows={5} />
        ) : (
          <BuyerActionsSummarySection cards={summaryCards} freshnessAt={freshnessAt} scope={scope} />
        )}

        {purchaseOrdersQuery.isError || suppliersQuery.isError || skusQuery.isError || locationsQuery.isError ? (
          <BuyerActionsErrorNotice
            title="Some buyer-action inputs could not be loaded"
            message={getApiErrorMessage(
              purchaseOrdersQuery.error ??
                suppliersQuery.error ??
                skusQuery.error ??
                locationsQuery.error,
              "One or more buyer action queries failed.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <div className="space-y-6">
              {purchaseOrdersQuery.isLoading && queueRows.length === 0 ? (
                <BuyerActionsSectionSkeleton rows={5} />
              ) : (
                <ActionablePurchaseOrderQueueSection
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
                      action: nextFilters.action,
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

              <OperationalFollowThroughSection
                purchaseOrder={selectedPurchaseOrder}
                feedback={feedback}
                lastMutationSummary={lastMutationSummary}
                scope={{
                  skuId: routeParams.skuId,
                  locationId: routeParams.locationId,
                }}
              />
            </div>
          }
          secondary={
            purchaseOrderDetailQuery.isLoading && selectedPurchaseOrder === null ? (
              <BuyerActionsSectionSkeleton rows={4} />
            ) : purchaseOrderDetailQuery.isError ? (
              <BuyerActionsErrorNotice
                title="Purchase order detail unavailable"
                message={getApiErrorMessage(
                  purchaseOrderDetailQuery.error,
                  "The selected purchase order could not be loaded.",
                )}
              />
            ) : (
              <PurchaseOrderActionPanel
                purchaseOrder={selectedPurchaseOrder}
                supplier={
                  supplierDetailQuery.data ??
                  suppliers.find((supplier) => supplier.id === focusedSupplierId) ??
                  null
                }
                supplierPerformance={supplierPerformanceQuery.data ?? null}
                supplierLeadTimes={supplierLeadTimesQuery.data ?? []}
                skus={skus}
                locations={locations}
              />
            )
          }
        />

        {supplierDetailQuery.isError || supplierPerformanceQuery.isError || supplierLeadTimesQuery.isError ? (
          <BuyerActionsErrorNotice
            title="Supplier action context unavailable"
            message={getApiErrorMessage(
              supplierDetailQuery.error ??
                supplierPerformanceQuery.error ??
                supplierLeadTimesQuery.error,
              "The focused supplier action context could not be loaded.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <SubmitDelaySection
              purchaseOrder={selectedPurchaseOrder}
              isSubmitPending={submitMutation.isPending}
              isDelayPending={delayMutation.isPending}
              onRequestSubmit={(purchaseOrder) =>
                setConfirmationState({
                  kind: "submit",
                  purchaseOrder,
                })
              }
              onRequestDelay={(purchaseOrder, values) =>
                setConfirmationState({
                  kind: "delay",
                  purchaseOrder,
                  values,
                })
              }
            />
          }
          secondary={
            <ReceivingSection
              purchaseOrder={selectedPurchaseOrder}
              skus={skus}
              locations={locations}
              defaultLocationId={routeParams.locationId}
              isPending={receiveMutation.isPending}
              onRequestReceive={(purchaseOrder, values) =>
                setConfirmationState({
                  kind: "receive",
                  purchaseOrder,
                  values,
                })
              }
            />
          }
        />
      </div>

      <ActionConfirmationDialog
        open={dialogConfig !== null}
        eyebrow="Confirm buyer action"
        title={dialogConfig?.title ?? ""}
        description={dialogConfig?.description ?? ""}
        confirmLabel={dialogConfig?.confirmLabel ?? "Confirm"}
        pending={isDialogPending}
        onClose={() => {
          if (!isDialogPending) {
            setConfirmationState(null);
          }
        }}
        onConfirm={() => handleConfirm()}
      />
    </>
  );
};
