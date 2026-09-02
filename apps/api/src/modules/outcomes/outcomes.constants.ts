export const STOCKOUT_DETECTION_RULE =
  "A stockout incident is detected when end-of-day ATP is less than or equal to zero and positive net demand exists on that UTC day within the measurement window.";

export const FILL_RATE_MEASUREMENT_RULE =
  "Fill rate is approximated as min(orderedQty, realizedSalesQty) / orderedQty for the same SKU-location window because explicit fulfillment events are not yet modeled.";

export const FORECAST_ERROR_MEASUREMENT_RULE =
  "Forecast error compares persisted forecast quantities for dates inside the measurement window against realized historical sales in the same SKU-location window.";

export const INVENTORY_COST_FORMULA =
  "holdingCostEstimate = onHandQty * unitCost * dailyCarryingRate * carryingDays; expediteCostEstimate = max(estimatedDailyDemandQty - max(availableToPromiseQty, 0), 0) * unitCost * expediteMultiplier.";

export const DECISION_OUTCOME_LINKAGE_RULE =
  "Decision outcomes use the successful execution completion time when present, otherwise the decision updatedAt timestamp, and evaluate explicit post-decision windows from stored inventory, demand, and forecast records.";

export const OUTCOME_STOCKOUT_SOURCE_TYPE = "outcome_window_detector";
export const DEFAULT_DAILY_CARRYING_RATE = 0.0005;
export const DEFAULT_EXPEDITE_MULTIPLIER = 0.15;
export const DEFAULT_OUTCOME_WINDOW_DAYS = 7;

export const outcomeAuditEventTypes = {
  stockoutDetected: "outcome.stockout.detected",
  fillRateMeasured: "outcome.fill_rate.measured",
  forecastErrorComputed: "outcome.forecast_error.computed",
  decisionComputed: "outcome.decision.computed",
  policyEffectivenessUpdated: "outcome.policy_effectiveness.updated",
  inventoryCostSnapshotted: "outcome.inventory_cost.snapshotted",
} as const;

export const outcomeOutboxEventTypes = {
  stockoutDetected: "outcome.stockout.detected.v1",
  fillRateMeasured: "outcome.fill_rate.measured.v1",
  forecastErrorComputed: "outcome.forecast_error.computed.v1",
  decisionComputed: "outcome.decision.computed.v1",
  policyEffectivenessUpdated: "outcome.policy_effectiveness.updated.v1",
} as const;
