import type {
  AnomalyHighlight,
  AnomalyScore,
  DecisionOutcome,
  FillRateMeasurement,
  ForecastErrorMeasurement,
  InventoryPosition,
  Location,
  MetricCardItem,
  PolicyEffectivenessSummary,
  RiskHotspot,
  RiskSeverity,
  Sku,
  StockoutIncident,
  TrendCardData,
  TrendPoint,
} from "./types";
import {
  formatCompactId,
  formatSeverityLabel,
  formatSignedNumber,
  formatSignedPercent,
  toShortDateLabel,
} from "./presentation";
import { formatDateTime, formatNumber, formatPercent } from "../../lib/utils/format";

const average = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const maxTimestamp = (values: Array<string | null | undefined>): string | null =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

const riskSeverityWeight = (severity: RiskSeverity): number => {
  switch (severity) {
    case "critical":
      return 3;
    case "high":
      return 2;
    case "medium":
      return 1;
  }
};

const anomalySeverityWeight = (severity: AnomalyScore["severity"]): number => {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
};

const buildSkuLabel = (skuId: string, skuMap: Map<string, Sku>): string => {
  const sku = skuMap.get(skuId);
  return sku ? `${sku.skuCode} - ${sku.name}` : skuId;
};

const buildLocationLabel = (locationId: string, locationMap: Map<string, Location>): string => {
  const location = locationMap.get(locationId);
  return location ? `${location.code} - ${location.name}` : locationId;
};

const buildScopeLabel = (
  skuId: string,
  locationId: string,
  skuMap: Map<string, Sku>,
  locationMap: Map<string, Location>,
): string => `${buildSkuLabel(skuId, skuMap)} @ ${buildLocationLabel(locationId, locationMap)}`;

const buildDeltaLabel = (
  current: number | null,
  previous: number | null,
  formatter: (value: number | null) => string,
): string | null => {
  if (current === null || previous === null) {
    return null;
  }

  return `${formatter(current - previous)} vs previous window`;
};

const groupByWindow = <T extends { measurementWindowEnd: string }>(
  items: T[],
  valueSelector: (item: T) => number | null,
): TrendPoint[] => {
  const groups = new Map<string, number[]>();

  items.forEach((item) => {
    const value = valueSelector(item);
    if (value === null) {
      return;
    }

    const bucket = groups.get(item.measurementWindowEnd) ?? [];
    bucket.push(value);
    groups.set(item.measurementWindowEnd, bucket);
  });

  return [...groups.entries()]
    .map(([timestamp, values]) => ({
      timestamp,
      label: toShortDateLabel(timestamp),
      value: average(values) ?? 0,
    }))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
};

export const createReferenceMaps = (skus: Sku[], locations: Location[]) => ({
  skuMap: new Map(skus.map((sku) => [sku.id, sku])),
  locationMap: new Map(locations.map((location) => [location.id, location])),
});

export const deriveRiskHotspots = (input: {
  positions: InventoryPosition[];
  stockouts: StockoutIncident[];
  anomalies: AnomalyScore[];
  skus: Sku[];
  locations: Location[];
}): RiskHotspot[] => {
  const { skuMap, locationMap } = createReferenceMaps(input.skus, input.locations);
  const activeIncidentByScope = new Map<string, StockoutIncident>();
  const anomalyByScope = new Map<string, AnomalyScore>();

  input.stockouts
    .filter((incident) => incident.incidentEndAt === null)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .forEach((incident) => {
      const key = `${incident.skuId}:${incident.locationId}`;
      if (!activeIncidentByScope.has(key)) {
        activeIncidentByScope.set(key, incident);
      }
    });

  input.anomalies
    .slice()
    .sort((left, right) => {
      const severityDelta = anomalySeverityWeight(right.severity) - anomalySeverityWeight(left.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      if (right.anomalyScore !== left.anomalyScore) {
        return right.anomalyScore - left.anomalyScore;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .forEach((anomaly) => {
      if (!anomalyByScope.has(anomaly.subjectReference)) {
        anomalyByScope.set(anomaly.subjectReference, anomaly);
      }
    });

  return input.positions
    .flatMap((position) => {
      const scopeKey = `${position.skuId}:${position.locationId}`;
      const incident = activeIncidentByScope.get(scopeKey) ?? null;
      const anomaly =
        anomalyByScope.get(scopeKey) ?? anomalyByScope.get(position.skuId) ?? null;

      let severity: RiskSeverity | null = null;
      if (position.availableToPromiseQty <= 0 || incident?.severity === "critical") {
        severity = "critical";
      } else if (
        incident !== null ||
        anomaly?.severity === "high" ||
        position.availableToPromiseQty <= position.reorderPointQty
      ) {
        severity = "high";
      } else if (
        anomaly?.severity === "medium" ||
        position.availableToPromiseQty <= position.safetyStockQty
      ) {
        severity = "medium";
      }

      if (severity === null) {
        return [];
      }

      const reasons: string[] = [];
      if (position.availableToPromiseQty <= 0) {
        reasons.push("Available to promise is depleted.");
      } else if (position.availableToPromiseQty <= position.reorderPointQty) {
        reasons.push("Available to promise is below reorder point.");
      } else if (position.availableToPromiseQty <= position.safetyStockQty) {
        reasons.push("Available to promise is within safety stock.");
      }

      if (incident) {
        reasons.push(`Open ${formatSeverityLabel(incident.severity ?? "warning")} stockout incident.`);
      }

      if (anomaly) {
        reasons.push(
          `${formatSeverityLabel(anomaly.severity)} anomaly score ${formatPercent(anomaly.anomalyScore)}.`,
        );
      }

      return [
        {
          key: scopeKey,
          skuId: position.skuId,
          locationId: position.locationId,
          severity,
          scopeLabel: buildScopeLabel(position.skuId, position.locationId, skuMap, locationMap),
          availableToPromiseQty: position.availableToPromiseQty,
          reorderPointQty: position.reorderPointQty,
          safetyStockQty: position.safetyStockQty,
          anomaly,
          incident,
          freshnessAt: maxTimestamp([
            position.updatedAt,
            incident?.updatedAt ?? null,
            anomaly?.updatedAt ?? null,
          ]),
          reasons,
        } satisfies RiskHotspot,
      ];
    })
    .sort((left, right) => {
      const severityDelta = riskSeverityWeight(right.severity) - riskSeverityWeight(left.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      if (left.availableToPromiseQty !== right.availableToPromiseQty) {
        return left.availableToPromiseQty - right.availableToPromiseQty;
      }

      return new Date(right.freshnessAt ?? 0).getTime() - new Date(left.freshnessAt ?? 0).getTime();
    });
};

export const deriveRiskMetricCards = (input: {
  positions: InventoryPosition[];
  stockouts: StockoutIncident[];
  anomalies: AnomalyScore[];
  hotspots: RiskHotspot[];
}): MetricCardItem[] => {
  const openIncidents = input.stockouts.filter((incident) => incident.incidentEndAt === null);
  const belowReorderPoint = input.positions.filter(
    (position) =>
      position.availableToPromiseQty > 0 && position.availableToPromiseQty <= position.reorderPointQty,
  );
  const criticalHotspots = input.hotspots.filter((hotspot) => hotspot.severity === "critical");
  const highAnomalies = input.anomalies.filter((anomaly) => anomaly.severity === "high");

  return [
    {
      id: "open-stockouts",
      label: "Open stockout incidents",
      value: formatNumber(openIncidents.length),
      helper: "Active incidents derived from stored stockout detection records.",
      tone: openIncidents.length > 0 ? "critical" : "neutral",
    },
    {
      id: "critical-risk",
      label: "Critical risk positions",
      value: formatNumber(criticalHotspots.length),
      helper: "Positions where ATP is depleted or a critical incident is open.",
      tone: criticalHotspots.length > 0 ? "critical" : "neutral",
    },
    {
      id: "below-reorder-point",
      label: "Below reorder point",
      value: formatNumber(belowReorderPoint.length),
      helper: "Current inventory positions with ATP below the persisted reorder point.",
      tone: belowReorderPoint.length > 0 ? "warning" : "neutral",
    },
    {
      id: "high-anomalies",
      label: "High anomalies",
      value: formatNumber(highAnomalies.length),
      helper: "High-severity anomaly advisories from the AI anomaly scoring layer.",
      tone: highAnomalies.length > 0 ? "warning" : "neutral",
    },
  ];
};

export const deriveAnomalyHighlights = (input: {
  anomalies: AnomalyScore[];
  skus: Sku[];
  locations: Location[];
}): AnomalyHighlight[] => {
  const { skuMap, locationMap } = createReferenceMaps(input.skus, input.locations);

  return input.anomalies
    .slice()
    .sort((left, right) => {
      const severityDelta = anomalySeverityWeight(right.severity) - anomalySeverityWeight(left.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      if (right.anomalyScore !== left.anomalyScore) {
        return right.anomalyScore - left.anomalyScore;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, 6)
    .map((anomaly) => {
      const [skuId, locationId] = anomaly.subjectReference.split(":");
      const normalizedSkuId = skuId ?? null;
      const normalizedLocationId =
        anomaly.subjectType === "sku_location" ? (locationId ?? null) : null;
      const scopeLabel =
        anomaly.subjectType === "sku_location" && skuId && locationId
          ? buildScopeLabel(skuId, locationId, skuMap, locationMap)
          : buildSkuLabel(anomaly.subjectReference, skuMap);

      return {
        id: anomaly.id,
        severity: anomaly.severity,
        scopeLabel,
        anomalyScore: anomaly.anomalyScore,
        explanationSummary: anomaly.explanationSummary,
        updatedAt: anomaly.updatedAt,
        measurementWindowEnd: anomaly.measurementWindowEnd,
        skuId: normalizedSkuId,
        locationId: normalizedLocationId,
      } satisfies AnomalyHighlight;
    });
};

export const deriveFillRateTrend = (measurements: FillRateMeasurement[]): TrendCardData => {
  const series = groupByWindow(measurements, (measurement) => measurement.fillRate);
  const latest = series.length > 0 ? series[series.length - 1] ?? null : null;
  const previous = series.length > 1 ? series[series.length - 2] ?? null : null;

  return {
    title: "Fill rate trend",
    subtitle: "Average fill rate from persisted fill-rate measurements.",
    valueLabel: latest ? formatPercent(latest.value) : "Not available",
    deltaLabel: buildDeltaLabel(latest?.value ?? null, previous?.value ?? null, formatSignedPercent),
    series,
    emptyMessage: "No fill-rate time series is available yet.",
  };
};

export const deriveForecastErrorTrend = (
  measurements: ForecastErrorMeasurement[],
): TrendCardData => {
  const hasPercentageSeries = measurements.some((measurement) => measurement.percentageError !== null);
  const series = hasPercentageSeries
    ? groupByWindow(measurements, (measurement) => measurement.percentageError)
    : groupByWindow(measurements, (measurement) => measurement.absoluteError);
  const latest = series.length > 0 ? series[series.length - 1] ?? null : null;
  const previous = series.length > 1 ? series[series.length - 2] ?? null : null;

  return {
    title: hasPercentageSeries ? "Forecast error trend" : "Forecast miss trend",
    subtitle: hasPercentageSeries
      ? "Average forecast percentage error from persisted forecast error measurements."
      : "Average absolute forecast miss when percentage error is unavailable.",
    valueLabel: latest
      ? hasPercentageSeries
        ? formatPercent(latest.value)
        : formatNumber(latest.value)
      : "Not available",
    deltaLabel: buildDeltaLabel(
      latest?.value ?? null,
      previous?.value ?? null,
      hasPercentageSeries ? formatSignedPercent : formatSignedNumber,
    ),
    series,
    emptyMessage: "No forecast error time series is available yet.",
  };
};

export const deriveOutcomeMetricCards = (input: {
  decisionOutcomes: DecisionOutcome[];
  policySummaries: PolicyEffectivenessSummary[];
}): MetricCardItem[] => {
  const latestOutcomeWindow =
    input.decisionOutcomes
      .map((outcome) => outcome.measurementWindowEnd)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const previousOutcomeWindow =
    [...new Set(input.decisionOutcomes.map((outcome) => outcome.measurementWindowEnd))]
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[1] ?? null;
  const latestOutcomes = latestOutcomeWindow
    ? input.decisionOutcomes.filter((outcome) => outcome.measurementWindowEnd === latestOutcomeWindow)
    : [];
  const previousOutcomes = previousOutcomeWindow
    ? input.decisionOutcomes.filter((outcome) => outcome.measurementWindowEnd === previousOutcomeWindow)
    : [];

  const latestPolicyWindow =
    input.policySummaries
      .map((summary) => summary.measurementWindowEnd)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const previousPolicyWindow =
    [...new Set(input.policySummaries.map((summary) => summary.measurementWindowEnd))]
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[1] ?? null;
  const latestPolicySummaries = latestPolicyWindow
    ? input.policySummaries.filter((summary) => summary.measurementWindowEnd === latestPolicyWindow)
    : [];
  const previousPolicySummaries = previousPolicyWindow
    ? input.policySummaries.filter((summary) => summary.measurementWindowEnd === previousPolicyWindow)
    : [];

  const latestStockoutAvoidanceRate = average(
    latestOutcomes
      .filter((outcome) => outcome.stockoutAvoided !== null)
      .map((outcome) => (outcome.stockoutAvoided ? 1 : 0)),
  );
  const previousStockoutAvoidanceRate = average(
    previousOutcomes
      .filter((outcome) => outcome.stockoutAvoided !== null)
      .map((outcome) => (outcome.stockoutAvoided ? 1 : 0)),
  );

  const latestFillRateDelta = average(
    latestOutcomes
      .filter((outcome) => outcome.fillRateDelta !== null)
      .map((outcome) => outcome.fillRateDelta as number),
  );
  const previousFillRateDelta = average(
    previousOutcomes
      .filter((outcome) => outcome.fillRateDelta !== null)
      .map((outcome) => outcome.fillRateDelta as number),
  );

  const latestHoldingCostDelta = average(
    latestOutcomes
      .filter((outcome) => outcome.holdingCostDelta !== null)
      .map((outcome) => outcome.holdingCostDelta as number),
  );
  const previousHoldingCostDelta = average(
    previousOutcomes
      .filter((outcome) => outcome.holdingCostDelta !== null)
      .map((outcome) => outcome.holdingCostDelta as number),
  );

  const latestExecutedDecisionCount = latestPolicySummaries.reduce(
    (sum, summary) => sum + summary.executedDecisionCount,
    0,
  );
  const previousExecutedDecisionCount = previousPolicySummaries.reduce(
    (sum, summary) => sum + summary.executedDecisionCount,
    0,
  );

  const cards: MetricCardItem[] = [
    {
      id: "measured-outcomes",
      label: "Measured outcomes",
      value: formatNumber(latestOutcomes.length),
      helper: latestOutcomeWindow
        ? `Computed decision outcomes for the latest window ending ${toShortDateLabel(latestOutcomeWindow)}.`
        : "No computed decision outcomes are available yet.",
      tone: latestOutcomes.length > 0 ? "positive" : "neutral",
      deltaLabel:
        previousOutcomeWindow !== null
          ? `${formatSignedNumber(latestOutcomes.length - previousOutcomes.length)} vs previous window`
          : null,
    },
    {
      id: "stockout-avoidance-rate",
      label: "Stockout avoided rate",
      value: latestStockoutAvoidanceRate !== null ? formatPercent(latestStockoutAvoidanceRate) : "Not available",
      helper: "Rate derived from computed decision outcomes where stockout avoidance was measurable.",
      tone:
        latestStockoutAvoidanceRate !== null && latestStockoutAvoidanceRate >= 0.5 ? "positive" : "neutral",
      deltaLabel: buildDeltaLabel(
        latestStockoutAvoidanceRate,
        previousStockoutAvoidanceRate,
        formatSignedPercent,
      ),
    },
    {
      id: "fill-rate-delta",
      label: "Average fill-rate delta",
      value: latestFillRateDelta !== null ? formatSignedPercent(latestFillRateDelta) : "Not available",
      helper: "Average fill-rate change captured on computed decision outcomes.",
      tone: latestFillRateDelta !== null && latestFillRateDelta > 0 ? "positive" : "neutral",
      deltaLabel: buildDeltaLabel(latestFillRateDelta, previousFillRateDelta, formatSignedPercent),
    },
  ];

  if (latestHoldingCostDelta !== null || previousHoldingCostDelta !== null) {
    cards.push({
      id: "holding-cost-delta",
      label: "Average holding cost delta",
      value: latestHoldingCostDelta !== null ? formatSignedNumber(latestHoldingCostDelta) : "Not available",
      helper: "Reported holding cost delta from the latest computed decision outcomes.",
      tone: latestHoldingCostDelta !== null && latestHoldingCostDelta < 0 ? "positive" : "neutral",
      deltaLabel: buildDeltaLabel(latestHoldingCostDelta, previousHoldingCostDelta, formatSignedNumber),
    });
  } else {
    cards.push({
      id: "executed-decisions",
      label: "Executed decisions",
      value: formatNumber(latestExecutedDecisionCount),
      helper: latestPolicyWindow
        ? `Total executed decisions across policy summaries for the latest window ending ${toShortDateLabel(latestPolicyWindow)}.`
        : "No policy effectiveness summaries are available yet.",
      tone: latestExecutedDecisionCount > 0 ? "positive" : "neutral",
      deltaLabel:
        previousPolicyWindow !== null
          ? `${formatSignedNumber(latestExecutedDecisionCount - previousExecutedDecisionCount)} vs previous window`
          : null,
    });
  }

  return cards;
};

export const sortPolicySummaries = (summaries: PolicyEffectivenessSummary[]): PolicyEffectivenessSummary[] =>
  summaries
    .slice()
    .sort((left, right) => {
      const dateDelta =
        new Date(right.measurementWindowEnd).getTime() - new Date(left.measurementWindowEnd).getTime();
      if (dateDelta !== 0) {
        return dateDelta;
      }

      return left.policyId.localeCompare(right.policyId);
    });

export const getRiskFreshnessLabel = (input: {
  positions: InventoryPosition[];
  stockouts: StockoutIncident[];
  anomalies: AnomalyScore[];
}): string => {
  const freshnessAt = maxTimestamp([
    ...input.positions.map((position) => position.updatedAt),
    ...input.stockouts.map((incident) => incident.updatedAt),
    ...input.anomalies.map((anomaly) => anomaly.updatedAt),
  ]);

  return freshnessAt ? `Fresh as of ${formatDateTime(freshnessAt)}` : "Freshness not available";
};

export const getOutcomesFreshnessLabel = (input: {
  fillRates: FillRateMeasurement[];
  forecastErrors: ForecastErrorMeasurement[];
  decisionOutcomes: DecisionOutcome[];
  policySummaries: PolicyEffectivenessSummary[];
}): string => {
  const freshnessAt = maxTimestamp([
    ...input.fillRates.map((measurement) => measurement.updatedAt),
    ...input.forecastErrors.map((measurement) => measurement.updatedAt),
    ...input.decisionOutcomes.map((outcome) => outcome.updatedAt),
    ...input.policySummaries.map((summary) => summary.updatedAt),
  ]);

  return freshnessAt ? `Fresh as of ${formatDateTime(freshnessAt)}` : "Freshness not available";
};

export const getPolicySummaryScopeLabel = (summary: PolicyEffectivenessSummary): string =>
  summary.scopeReference ?? formatCompactId(summary.policyId);
