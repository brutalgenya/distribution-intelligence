import type { ApprovalTask, Decision, DecisionOutcome } from "../decisions/types";
import type { MetricCardItem, MetricTone, PolicyEffectivenessSummary } from "../outcomes/types";
import type { Policy } from "../policies/types";
import type { SupportExecutionTask, SupportTimelineItem } from "../workflow/types";

export type {
  ApprovalTask,
  Decision,
  DecisionOutcome,
  Policy,
  PolicyEffectivenessSummary,
  SupportExecutionTask,
  SupportTimelineItem,
};

export type OperatorOverrideType =
  | "manual_approve"
  | "manual_reject"
  | "manual_cancel_execution"
  | "manual_retry"
  | "manual_close_exception"
  | "manual_request_execution"
  | "manual_request_approval";

export interface OperatorOverride {
  id: string;
  organizationId: string;
  decisionId: string | null;
  executionTaskId: string | null;
  overrideType: OperatorOverrideType;
  reason: string;
  payload: unknown;
  createdByUserId: string;
  createdAt: string;
}

export interface ApprovalGovernanceRouteParams {
  approvalTaskId: string | null;
  decisionId: string | null;
  policyId: string | null;
  status: ApprovalTask["status"] | "all";
  decisionType: Decision["decisionType"] | "all";
  overrideType: OperatorOverrideType | "all";
}

export interface GovernanceFrictionSummary {
  title: string;
  tone: MetricTone;
  helper: string;
  cards: MetricCardItem[];
}

export interface ApprovalRow extends ApprovalTask {
  decision: Decision | null;
  policy: Policy | null;
  waitMinutes: number | null;
  waitLabel: string;
  relatedOverrideCount: number;
}

export interface OverrideRow extends OperatorOverride {
  decision: Decision | null;
  execution: SupportExecutionTask | null;
  policy: Policy | null;
}

export interface InterventionPatternRow {
  key: string;
  policyId: string | null;
  policyName: string;
  policyTypeLabel: string;
  decisionCount: number;
  approvalCount: number;
  pendingApprovalCount: number;
  rejectedApprovalCount: number;
  overrideCount: number;
  manualApproveCount: number;
  manualRejectCount: number;
  overrideRate: number | null;
  latestEffectivenessAt: string | null;
}

export interface GovernanceAuditItem {
  id: string;
  createdAt: string;
  correlationId: string | null;
  title: string;
  sourceType: SupportTimelineItem["type"];
  description: string;
  metadataPreview: string;
}

export interface ApprovalGovernanceFeedback {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
}

export const approvalStatusOptions: Array<{ label: string; value: ApprovalTask["status"] | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Cancelled", value: "cancelled" },
];

export const approvalDecisionTypeOptions: Array<{ label: string; value: Decision["decisionType"] | "all" }> = [
  { label: "All decision types", value: "all" },
  { label: "Replenishment", value: "replenishment" },
  { label: "Allocation", value: "allocation" },
  { label: "Exception", value: "exception" },
];

export const overrideTypeOptions: Array<{ label: string; value: OperatorOverrideType | "all" }> = [
  { label: "All override types", value: "all" },
  { label: "Manual approve", value: "manual_approve" },
  { label: "Manual reject", value: "manual_reject" },
  { label: "Manual cancel execution", value: "manual_cancel_execution" },
  { label: "Manual retry", value: "manual_retry" },
  { label: "Manual close exception", value: "manual_close_exception" },
  { label: "Manual request execution", value: "manual_request_execution" },
  { label: "Manual request approval", value: "manual_request_approval" },
];
