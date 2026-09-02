import { DecisionType } from "@prisma/client";

export const DecisionReasonCodes = {
  reorderPointBreached: "reorder_point_breached",
  forecastExceedsAvailableSupply: "forecast_exceeds_available_supply",
  supplierLeadTimeIncrease: "supplier_lead_time_increase",
  noPrimarySupplier: "no_primary_supplier",
  demandSpikeDetected: "demand_spike_detected",
  allocationConflict: "allocation_conflict",
  openPurchaseOrderInsufficient: "open_purchase_order_insufficient",
  missingForecast: "missing_forecast",
  conflictingDataState: "conflicting_data_state",
} as const;

export type DecisionReasonCode = (typeof DecisionReasonCodes)[keyof typeof DecisionReasonCodes];

export const DecisionArtifactTypes = {
  inventorySnapshot: "inventory_snapshot",
  forecastSnapshot: "forecast_snapshot",
  supplySnapshot: "supply_snapshot",
  demandSnapshot: "demand_snapshot",
  policySnapshot: "policy_snapshot",
} as const;

export const decisionAuditEventTypes: Record<DecisionType, string> = {
  [DecisionType.replenishment]: "decision.replenishment.proposed",
  [DecisionType.allocation]: "decision.allocation.proposed",
  [DecisionType.exception]: "decision.exception.raised",
};

export const decisionOutboxEventTypes: Record<DecisionType, string> = {
  [DecisionType.replenishment]: "decision.replenishment.proposed.v1",
  [DecisionType.allocation]: "decision.allocation.proposed.v1",
  [DecisionType.exception]: "decision.exception.raised.v1",
};
