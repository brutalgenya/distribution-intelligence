import type { Decision, ApprovalTask } from "../decisions/types";
import type { MetricCardItem, MetricTone, PolicyEffectivenessSummary } from "../outcomes/types";
import type { SupportTimelineItem } from "../workflow/types";

export type { Decision, ApprovalTask, PolicyEffectivenessSummary, SupportTimelineItem };

export type PolicyType = "replenishment" | "allocation" | "exception";
export type PolicyStatus = "draft" | "active" | "archived";
export type AutomationTier = "observe" | "recommend" | "draft_only" | "auto_execute";

export interface ReplenishmentPolicyRules {
  automationTier: AutomationTier;
  forecastHorizonDays: number;
  targetDaysOfCover: number;
  leadTimeBufferDays: number;
  defaultLeadTimeDays: number;
  useSafetyStock: boolean;
  shortageBufferQty: number;
  demandSpikeMultiplier: number;
}

export interface AllocationPolicyRules {
  automationTier: AutomationTier;
  shortageThresholdQty: number;
  prioritizationMode: "oldest_order_first";
  maxAffectedOrders: number;
}

export interface ExceptionPolicyRules {
  automationTier: AutomationTier;
  forecastHorizonDays: number;
  leadTimeDriftThresholdDays: number;
  demandSpikeMultiplier: number;
  stockoutRiskCoverDays: number;
}

export type PolicyRules =
  | ReplenishmentPolicyRules
  | AllocationPolicyRules
  | ExceptionPolicyRules;

export interface Policy {
  id: string;
  organizationId: string;
  policyType: PolicyType;
  name: string;
  version: number;
  status: PolicyStatus;
  rulesJson: PolicyRules;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyFilters {
  policyType?: PolicyType;
  status?: PolicyStatus;
}

export interface PoliciesRouteParams {
  policyId: string | null;
  policyType: PolicyType | "all";
  status: PolicyStatus | "all";
}

export interface PolicyRow extends Policy {
  latestSummary: PolicyEffectivenessSummary | null;
  relatedDecisionCount: number;
  observedApprovalCount: number;
  pendingApprovalCount: number;
}

export interface GovernanceSummary {
  title: string;
  tone: MetricTone;
  helper: string;
  cards: MetricCardItem[];
}

export interface PolicyEditorState {
  policyType: PolicyType;
  name: string;
  version: string;
  automationTier: AutomationTier;
  forecastHorizonDays: string;
  targetDaysOfCover: string;
  leadTimeBufferDays: string;
  defaultLeadTimeDays: string;
  useSafetyStock: boolean;
  shortageBufferQty: string;
  demandSpikeMultiplier: string;
  shortageThresholdQty: string;
  prioritizationMode: "oldest_order_first";
  maxAffectedOrders: string;
  leadTimeDriftThresholdDays: string;
  stockoutRiskCoverDays: string;
}

export interface CreatePolicyInput {
  policyType: PolicyType;
  name: string;
  version: number;
  rulesJson: PolicyRules;
}

export interface UpdatePolicyInput {
  name?: string;
  rulesJson?: PolicyRules;
}

export interface PolicyActionFeedback {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
}

export interface PolicyAuditItem {
  id: string;
  createdAt: string;
  correlationId: string | null;
  sourceType: SupportTimelineItem["type"];
  title: string;
  description: string;
  metadataPreview: string;
}

export const policyTypeOptions: Array<{ label: string; value: PolicyType | "all" }> = [
  { label: "All policy types", value: "all" },
  { label: "Replenishment", value: "replenishment" },
  { label: "Allocation", value: "allocation" },
  { label: "Exception", value: "exception" },
];

export const policyStatusOptions: Array<{ label: string; value: PolicyStatus | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

export const automationTierOptions: Array<{ label: string; value: AutomationTier }> = [
  { label: "Observe", value: "observe" },
  { label: "Recommend", value: "recommend" },
  { label: "Draft only", value: "draft_only" },
  { label: "Auto execute", value: "auto_execute" },
];
