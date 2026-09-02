import { formatDateTime, formatLabel } from "../../lib/utils/format";
import type {
  CustomerOrder,
  CustomerOrderLine,
  ForecastJob,
  ForecastResult,
  InvestigationContextData,
  InvestigationParams,
  InvestigationRiskSummary,
  InvestigationSignalsData,
  InvestigationSupplyData,
  MatchedCustomerOrder,
  MatchedPurchaseOrder,
  PurchaseOrder,
  PurchaseOrderLine,
  Supplier,
  SupplierLeadTimeStat,
} from "./types";

const maxTimestamp = (values: Array<string | null | undefined>): string | null =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

export const parseScopeReference = (
  value: unknown,
): { skuId?: string; locationId?: string } | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    ...(typeof candidate.skuId === "string" ? { skuId: candidate.skuId } : {}),
    ...(typeof candidate.locationId === "string" ? { locationId: candidate.locationId } : {}),
  };
};

export const isRelevantForecastJob = (
  job: ForecastJob,
  params: InvestigationParams,
): boolean => {
  const scopeReference = parseScopeReference(job.scopeReference);

  if (job.scopeType === "sku_location") {
    return (
      scopeReference?.skuId === params.skuId &&
      scopeReference.locationId === params.locationId
    );
  }

  if (job.scopeType === "sku") {
    return scopeReference?.skuId === params.skuId;
  }

  return false;
};

export const selectRelevantForecastResults = (
  results: ForecastResult[],
  params: InvestigationParams,
): ForecastResult[] =>
  results
    .filter(
      (result) =>
        result.skuId === params.skuId &&
        (result.locationId === params.locationId || result.locationId === null),
    )
    .sort((left, right) => new Date(left.forecastDate).getTime() - new Date(right.forecastDate).getTime());

const matchOrderLines = (
  lines: CustomerOrderLine[],
  params: InvestigationParams,
): CustomerOrderLine[] =>
  lines.filter(
    (line) => line.skuId === params.skuId && line.locationId === params.locationId,
  );

export const matchCustomerOrders = (
  orders: CustomerOrder[],
  params: InvestigationParams,
): MatchedCustomerOrder[] =>
  orders
    .flatMap((order) => {
      const matchingLines = matchOrderLines(order.lines, params);

      if (matchingLines.length === 0) {
        return [];
      }

      return [
        {
          order,
          matchingLines,
          matchedQuantity: matchingLines.reduce((sum, line) => sum + line.quantity, 0),
        } satisfies MatchedCustomerOrder,
      ];
    })
    .sort(
      (left, right) =>
        new Date(right.order.orderedAt).getTime() - new Date(left.order.orderedAt).getTime(),
    )
    .slice(0, 8);

const matchPurchaseOrderLines = (
  lines: PurchaseOrderLine[],
  params: InvestigationParams,
): PurchaseOrderLine[] =>
  lines.filter(
    (line) =>
      line.skuId === params.skuId &&
      (line.expectedLocationId === params.locationId || line.expectedLocationId === null),
  );

export const matchPurchaseOrders = (
  purchaseOrders: PurchaseOrder[],
  params: InvestigationParams,
): MatchedPurchaseOrder[] =>
  purchaseOrders
    .flatMap((purchaseOrder) => {
      const matchingLines = matchPurchaseOrderLines(purchaseOrder.lines, params);

      if (matchingLines.length === 0) {
        return [];
      }

      return [
        {
          purchaseOrder,
          matchingLines,
          openQuantity: matchingLines.reduce(
            (sum, line) => sum + Math.max(line.quantityOrdered - line.quantityReceived, 0),
            0,
          ),
        } satisfies MatchedPurchaseOrder,
      ];
    })
    .sort((left, right) => {
      const leftDate = left.purchaseOrder.expectedDeliveryAt ?? left.purchaseOrder.createdAt;
      const rightDate = right.purchaseOrder.expectedDeliveryAt ?? right.purchaseOrder.createdAt;
      return new Date(leftDate).getTime() - new Date(rightDate).getTime();
    });

export const selectSkuLocationLabel = (context: InvestigationContextData): string => {
  const locationLabel = context.location
    ? `${context.location.code} - ${context.location.name}`
    : context.position?.locationId ?? "Unknown location";

  return `${context.sku.skuCode} - ${context.sku.name} @ ${locationLabel}`;
};

export const deriveRiskSummary = (
  context: InvestigationContextData,
  signals: InvestigationSignalsData,
): InvestigationRiskSummary => {
  const activeIncident = signals.stockouts.find((incident) => incident.incidentEndAt === null) ?? null;
  const highestAnomaly = signals.anomalies
    .slice()
    .sort((left, right) => right.anomalyScore - left.anomalyScore)[0] ?? null;
  const reasons: string[] = [];

  let level: InvestigationRiskSummary["level"] = "stable";
  if (context.position && context.position.availableToPromiseQty <= 0) {
    level = "critical";
    reasons.push("Available to promise is depleted.");
  } else if (
    context.position &&
    context.position.availableToPromiseQty <= context.position.reorderPointQty
  ) {
    level = "high";
    reasons.push("Available to promise is below reorder point.");
  } else if (
    context.position &&
    context.position.availableToPromiseQty <= context.position.safetyStockQty
  ) {
    level = "watch";
    reasons.push("Available to promise is within safety stock.");
  }

  if (activeIncident) {
    level = "critical";
    reasons.push(`Open stockout incident since ${formatDateTime(activeIncident.incidentStartAt)}.`);
  }

  if (highestAnomaly?.severity === "high") {
    if (level !== "critical") {
      level = "high";
    }
    reasons.push("High anomaly advisory is active for this scope.");
  } else if (highestAnomaly?.severity === "medium" && level === "stable") {
    level = "watch";
    reasons.push("Medium anomaly advisory is active for this scope.");
  }

  if (reasons.length === 0) {
    reasons.push("No open stockout or anomaly signal is currently persisted for this scope.");
  }

  return {
    level,
    label:
      level === "critical"
        ? "Critical risk"
        : level === "high"
          ? "High risk"
          : level === "watch"
            ? "Watch closely"
            : "Currently stable",
    reasons,
    freshnessAt: maxTimestamp([
      context.position?.updatedAt ?? null,
      ...signals.stockouts.map((incident) => incident.updatedAt),
      ...signals.anomalies.map((anomaly) => anomaly.updatedAt),
    ]),
  };
};

export const getRiskToneClasses = (
  level: InvestigationRiskSummary["level"],
): { badgeClassName: string; panelClassName: string } => {
  switch (level) {
    case "critical":
      return {
        badgeClassName: "bg-red-100 text-red-700",
        panelClassName: "border-red-200 bg-red-50/80",
      };
    case "high":
      return {
        badgeClassName: "bg-amber-100 text-amber-800",
        panelClassName: "border-amber-200 bg-amber-50/80",
      };
    case "watch":
      return {
        badgeClassName: "bg-sky-100 text-sky-700",
        panelClassName: "border-sky-200 bg-sky-50/80",
      };
    case "stable":
      return {
        badgeClassName: "bg-pine/15 text-pine",
        panelClassName: "border-pine/20 bg-pine/10",
      };
  }
};

export const formatForecastScopeType = (value: ForecastJob["scopeType"]): string =>
  value === "sku_location" ? "SKU + location" : formatLabel(value);

export const formatPurchaseOrderStatus = (value: string): string =>
  value === "partially_received" ? "Partially received" : formatLabel(value);

export const buildSupplierLookup = (suppliers: Supplier[]): Map<string, Supplier> =>
  new Map(suppliers.map((supplier) => [supplier.id, supplier]));

export const buildLeadTimeLookup = (
  stats: SupplierLeadTimeStat[],
): Map<string, SupplierLeadTimeStat> =>
  new Map(stats.map((stat) => [stat.supplierId, stat]));

export const summarizeSupplyCoverage = (
  supply: InvestigationSupplyData,
): Array<{ label: string; value: string }> => {
  const primaryMappings = supply.mappings.filter((mapping) => mapping.isPrimary);
  const inboundOpenQty = supply.openPurchaseOrders.reduce(
    (sum, purchaseOrder) => sum + purchaseOrder.openQuantity,
    0,
  );

  return [
    {
      label: "Supplier mappings",
      value: String(supply.mappings.length),
    },
    {
      label: "Primary suppliers",
      value: String(primaryMappings.length),
    },
    {
      label: "Open purchase orders",
      value: String(supply.openPurchaseOrders.length),
    },
    {
      label: "Open inbound quantity",
      value: String(inboundOpenQty),
    },
  ];
};
