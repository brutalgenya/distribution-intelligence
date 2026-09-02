export type DecisionType = "replenishment" | "allocation" | "exception";

export type DecisionStatus =
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "execution_requested"
  | "executing"
  | "executed"
  | "execution_failed"
  | "superseded"
  | "dismissed";

export type AutomationTier = "observe" | "recommend" | "draft_only" | "auto_execute";

export type ApprovalTaskStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface DecisionReason {
  id: string;
  code: string;
  message: string;
  createdAt: string;
}

export interface DecisionScore {
  id: string;
  metric: string;
  value: number;
  createdAt: string;
}

export interface DecisionArtifact {
  id: string;
  artifactType: string;
  payload: unknown;
  createdAt: string;
}

export interface Decision {
  id: string;
  organizationId: string;
  decisionType: DecisionType;
  status: DecisionStatus;
  automationTier: AutomationTier;
  policyId: string;
  policyVersion: number;
  skuId: string | null;
  locationId: string | null;
  supplierId: string | null;
  confidenceScore: number | null;
  proposedPayload: unknown;
  rationale: unknown;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  reasons: DecisionReason[];
  scores: DecisionScore[];
  artifacts: DecisionArtifact[];
}

export interface ApprovalTask {
  id: string;
  organizationId: string;
  decisionId: string;
  purpose: string;
  status: ApprovalTaskStatus;
  requestedByUserId: string | null;
  assignedToUserId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionExplanation {
  id: string;
  organizationId: string;
  decisionId: string;
  aiRunId: string;
  modelRegistryEntryId: string;
  provider: string;
  modelName: string;
  modelVersion: string;
  summary: string;
  explanationJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionOutcome {
  id: string;
  organizationId: string;
  decisionId: string;
  executionTaskId: string | null;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  outcomeStatus: "pending" | "computed" | "insufficient_data";
  stockoutAvoided: boolean | null;
  fillRateDelta: number | null;
  inventoryDaysDelta: number | null;
  holdingCostDelta: number | null;
  expediteCostDelta: number | null;
  summaryJson: unknown;
  computedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionFilters {
  decisionType?: DecisionType;
  status?: DecisionStatus;
}

export const decisionTypeOptions: Array<{ label: string; value: DecisionType | "all" }> = [
  { label: "All types", value: "all" },
  { label: "Replenishment", value: "replenishment" },
  { label: "Allocation", value: "allocation" },
  { label: "Exception", value: "exception" },
];

export const decisionStatusOptions: Array<{ label: string; value: DecisionStatus | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Proposed", value: "proposed" },
  { label: "Awaiting approval", value: "awaiting_approval" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Execution requested", value: "execution_requested" },
  { label: "Executing", value: "executing" },
  { label: "Executed", value: "executed" },
  { label: "Execution failed", value: "execution_failed" },
  { label: "Superseded", value: "superseded" },
  { label: "Dismissed", value: "dismissed" },
];
