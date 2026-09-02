export type ExecutionTaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "dead_lettered"
  | "cancelled";

export type ExecutionTaskType =
  | "create_purchase_order"
  | "create_transfer_order"
  | "notify_operator";

export type ExecutionTargetSystem =
  | "internal_supply"
  | "internal_notification"
  | "erp"
  | "wms"
  | "manual_bridge";

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

export type DecisionType = "replenishment" | "allocation" | "exception";

export type AutomationTier = "observe" | "recommend" | "draft_only" | "auto_execute";

export interface SupportExecutionAttempt {
  id: string;
  organizationId: string;
  executionTaskId: string;
  attemptNumber: number;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  responsePayload: unknown;
  createdAt: string;
}

export interface ExecutionDecisionReference {
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
}

export interface SupportExecutionTask {
  id: string;
  organizationId: string;
  decisionId: string;
  taskType: ExecutionTaskType;
  status: ExecutionTaskStatus;
  targetSystem: ExecutionTargetSystem;
  payload: unknown;
  requestedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: SupportExecutionAttempt[];
  decision: ExecutionDecisionReference;
}

export interface SupportTimelineItem {
  type: "audit_event" | "execution_attempt" | "ai_run" | "outbox_event" | "decision_outcome";
  id: string;
  createdAt: string;
  correlationId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface WorkerStatus {
  workerType: "forecast" | "execution" | "outcomes" | "integration";
  lastRunAt: string | null;
  lastStatus: "running" | "succeeded" | "failed" | null;
  currentlyRunning: boolean;
  recentFailureCount: number;
  recentProcessedCount: number;
  retryBacklog: number;
  deadLetterCount: number;
  lastError: string | null;
}

export interface WorkflowQueueFilters {
  status?: ExecutionTaskStatus;
  from?: string;
  to?: string;
}

export const executionStatusOptions: Array<{ label: string; value: ExecutionTaskStatus | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
  { label: "Dead-lettered", value: "dead_lettered" },
  { label: "Cancelled", value: "cancelled" },
];

export const executionTaskTypeOptions: Array<{ label: string; value: ExecutionTaskType | "all" }> = [
  { label: "All task types", value: "all" },
  { label: "Create purchase order", value: "create_purchase_order" },
  { label: "Create transfer order", value: "create_transfer_order" },
  { label: "Notify operator", value: "notify_operator" },
];
