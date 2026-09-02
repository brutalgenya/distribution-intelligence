import { formatDateTime, formatLabel, formatNumber, formatPercent } from "../../lib/utils/format";
import { formatAutomationTier, formatDecisionStatus, formatDecisionType } from "../decisions/presentation";
import type {
  AllocationPolicyRules,
  ApprovalTask,
  CreatePolicyInput,
  Decision,
  ExceptionPolicyRules,
  GovernanceSummary,
  PoliciesRouteParams,
  Policy,
  PolicyActionFeedback,
  PolicyAuditItem,
  PolicyEditorState,
  PolicyEffectivenessSummary,
  PolicyFilters,
  PolicyRow,
  PolicyStatus,
  PolicyType,
  ReplenishmentPolicyRules,
  SupportTimelineItem,
  UpdatePolicyInput,
} from "./types";

const toTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

const stringifyValue = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "Not available";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unsupported value";
  }
};

const truncateText = (value: string, maxLength = 220): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

const getPolicyStatusRank = (status: PolicyStatus): number => {
  switch (status) {
    case "active":
      return 0;
    case "draft":
      return 1;
    case "archived":
      return 2;
  }
};

export const formatPolicyType = (value: PolicyType): string => formatLabel(value);

export const formatPolicyStatus = (value: PolicyStatus): string => formatLabel(value);

export const getPolicyAutomationTier = (policy: Policy): Policy["rulesJson"]["automationTier"] =>
  policy.rulesJson.automationTier;

export const isDraftPolicy = (policy: Policy | null): policy is Policy =>
  policy !== null && policy.status === "draft";

export const isActivatablePolicy = (policy: Policy | null): boolean =>
  policy !== null && policy.status === "draft";

export const createDefaultPolicyEditorState = (
  policyType: PolicyType = "replenishment",
): PolicyEditorState => ({
  policyType,
  name: "",
  version: "1",
  automationTier: policyType === "exception" ? "observe" : "recommend",
  forecastHorizonDays: "14",
  targetDaysOfCover: "14",
  leadTimeBufferDays: "0",
  defaultLeadTimeDays: "7",
  useSafetyStock: true,
  shortageBufferQty: "0",
  demandSpikeMultiplier: "2",
  shortageThresholdQty: "1",
  prioritizationMode: "oldest_order_first",
  maxAffectedOrders: "20",
  leadTimeDriftThresholdDays: "3",
  stockoutRiskCoverDays: "3",
});

export const buildPolicyEditorState = (policy: Policy): PolicyEditorState => {
  const baseState = createDefaultPolicyEditorState(policy.policyType);
  const nextState: PolicyEditorState = {
    ...baseState,
    policyType: policy.policyType,
    name: policy.name,
    version: String(policy.version),
    automationTier: policy.rulesJson.automationTier,
  };

  if (policy.policyType === "replenishment") {
    const rules = policy.rulesJson as ReplenishmentPolicyRules;

    return {
      ...nextState,
      forecastHorizonDays: String(rules.forecastHorizonDays),
      targetDaysOfCover: String(rules.targetDaysOfCover),
      leadTimeBufferDays: String(rules.leadTimeBufferDays),
      defaultLeadTimeDays: String(rules.defaultLeadTimeDays),
      useSafetyStock: rules.useSafetyStock,
      shortageBufferQty: String(rules.shortageBufferQty),
      demandSpikeMultiplier: String(rules.demandSpikeMultiplier),
    };
  }

  if (policy.policyType === "allocation") {
    const rules = policy.rulesJson as AllocationPolicyRules;

    return {
      ...nextState,
      shortageThresholdQty: String(rules.shortageThresholdQty),
      prioritizationMode: rules.prioritizationMode,
      maxAffectedOrders: String(rules.maxAffectedOrders),
    };
  }

  const rules = policy.rulesJson as ExceptionPolicyRules;

  return {
    ...nextState,
    forecastHorizonDays: String(rules.forecastHorizonDays),
    leadTimeDriftThresholdDays: String(rules.leadTimeDriftThresholdDays),
    demandSpikeMultiplier: String(rules.demandSpikeMultiplier),
    stockoutRiskCoverDays: String(rules.stockoutRiskCoverDays),
  };
};

export const buildCreatePolicyInput = (draft: PolicyEditorState): CreatePolicyInput => {
  const version = Number(draft.version);

  switch (draft.policyType) {
    case "replenishment":
      return {
        policyType: draft.policyType,
        name: draft.name.trim(),
        version,
        rulesJson: {
          automationTier: draft.automationTier,
          forecastHorizonDays: Number(draft.forecastHorizonDays),
          targetDaysOfCover: Number(draft.targetDaysOfCover),
          leadTimeBufferDays: Number(draft.leadTimeBufferDays),
          defaultLeadTimeDays: Number(draft.defaultLeadTimeDays),
          useSafetyStock: draft.useSafetyStock,
          shortageBufferQty: Number(draft.shortageBufferQty),
          demandSpikeMultiplier: Number(draft.demandSpikeMultiplier),
        },
      };
    case "allocation":
      return {
        policyType: draft.policyType,
        name: draft.name.trim(),
        version,
        rulesJson: {
          automationTier: draft.automationTier,
          shortageThresholdQty: Number(draft.shortageThresholdQty),
          prioritizationMode: draft.prioritizationMode,
          maxAffectedOrders: Number(draft.maxAffectedOrders),
        },
      };
    case "exception":
      return {
        policyType: draft.policyType,
        name: draft.name.trim(),
        version,
        rulesJson: {
          automationTier: draft.automationTier,
          forecastHorizonDays: Number(draft.forecastHorizonDays),
          leadTimeDriftThresholdDays: Number(draft.leadTimeDriftThresholdDays),
          demandSpikeMultiplier: Number(draft.demandSpikeMultiplier),
          stockoutRiskCoverDays: Number(draft.stockoutRiskCoverDays),
        },
      };
  }
};

export const buildUpdatePolicyInput = (draft: PolicyEditorState): UpdatePolicyInput => {
  const createInput = buildCreatePolicyInput(draft);

  return {
    name: createInput.name,
    rulesJson: createInput.rulesJson,
  };
};

export const buildPolicyRows = (
  policies: Policy[],
  summaries: PolicyEffectivenessSummary[],
  decisions: Decision[],
  approvals: ApprovalTask[],
): PolicyRow[] => {
  const decisionIdsByPolicy = new Map<string, string[]>();

  decisions.forEach((decision) => {
    const currentIds = decisionIdsByPolicy.get(decision.policyId) ?? [];
    currentIds.push(decision.id);
    decisionIdsByPolicy.set(decision.policyId, currentIds);
  });

  const latestSummaryByPolicy = new Map<string, PolicyEffectivenessSummary>();

  summaries
    .slice()
    .sort(
      (left, right) =>
        toTimestamp(right.measurementWindowEnd) - toTimestamp(left.measurementWindowEnd),
    )
    .forEach((summary) => {
      if (!latestSummaryByPolicy.has(summary.policyId)) {
        latestSummaryByPolicy.set(summary.policyId, summary);
      }
    });

  return policies
    .map((policy) => {
      const decisionIds = new Set(decisionIdsByPolicy.get(policy.id) ?? []);
      const relatedApprovals = approvals.filter((approval) => decisionIds.has(approval.decisionId));

      return {
        ...policy,
        latestSummary: latestSummaryByPolicy.get(policy.id) ?? null,
        relatedDecisionCount: decisionIds.size,
        observedApprovalCount: relatedApprovals.length,
        pendingApprovalCount: relatedApprovals.filter((approval) => approval.status === "pending")
          .length,
      } satisfies PolicyRow;
    })
    .sort((left, right) => {
      const statusDelta = getPolicyStatusRank(left.status) - getPolicyStatusRank(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      const typeDelta = left.policyType.localeCompare(right.policyType);
      if (typeDelta !== 0) {
        return typeDelta;
      }

      return right.version - left.version;
    });
};

export const deriveGovernanceSummary = (input: {
  policies: Policy[];
  decisions: Decision[];
  approvals: ApprovalTask[];
}): GovernanceSummary => {
  const activePolicies = input.policies.filter((policy) => policy.status === "active");
  const activeTypes = new Set(activePolicies.map((policy) => policy.policyType));
  const autoExecutePolicies = activePolicies.filter(
    (policy) => getPolicyAutomationTier(policy) === "auto_execute",
  );
  const humanControlledPolicies = activePolicies.filter(
    (policy) => getPolicyAutomationTier(policy) !== "auto_execute",
  );
  const decisionIds = new Set(input.decisions.map((decision) => decision.id));
  const observedApprovals = input.approvals.filter((approval) => decisionIds.has(approval.decisionId));
  const draftPolicies = input.policies.filter((policy) => policy.status === "draft");

  const tone =
    activePolicies.length === 0
      ? "critical"
      : autoExecutePolicies.length === activePolicies.length
        ? "warning"
        : autoExecutePolicies.length === 0
          ? "positive"
          : "neutral";

  const title =
    activePolicies.length === 0
      ? "Governance coverage is incomplete"
      : autoExecutePolicies.length === activePolicies.length
        ? "More automated governance is active"
        : autoExecutePolicies.length === 0
          ? "Human-controlled governance is active"
          : "Mixed governance posture is active";

  return {
    title,
    tone,
    helper:
      "This summary comes from persisted policy statuses, each policy's automationTier rule, and observed approval-task evidence on related decisions. The backend does not expose a separate policy approval-config endpoint today.",
    cards: [
      {
        id: "active-policies",
        label: "Active policies",
        value: formatNumber(activePolicies.length),
        helper: "Policies currently marked active in the decisioning module.",
        tone: activePolicies.length > 0 ? "positive" : "critical",
      },
      {
        id: "policy-types",
        label: "Policy types in use",
        value: formatNumber(activeTypes.size),
        helper: "Distinct active policy types currently governing platform decision areas.",
        tone: activeTypes.size > 0 ? "neutral" : "warning",
      },
      {
        id: "auto-execute-policies",
        label: "Auto-execute policies",
        value: formatNumber(autoExecutePolicies.length),
        helper: "Active policies whose persisted automation tier is auto_execute.",
        tone: autoExecutePolicies.length > 0 ? "warning" : "positive",
      },
      {
        id: "approval-evidence",
        label: "Observed approval tasks",
        value: formatNumber(observedApprovals.length),
        helper:
          humanControlledPolicies.length > 0
            ? "Observed workflow approval tasks linked to persisted decisions under current governance."
            : `There are ${formatNumber(draftPolicies.length)} draft policies awaiting activation or review.`,
        tone: observedApprovals.length > 0 ? "neutral" : draftPolicies.length > 0 ? "warning" : "neutral",
      },
    ],
  };
};

export const deriveLatestGovernanceEvidenceAt = (input: {
  policies: Policy[];
  summaries: PolicyEffectivenessSummary[];
  decisions: Decision[];
  approvals: ApprovalTask[];
  auditTimeline: SupportTimelineItem[];
}): string | null =>
  [
    ...input.policies.map((policy) => policy.updatedAt),
    ...input.summaries.map((summary) => summary.updatedAt),
    ...input.decisions.map((decision) => decision.updatedAt),
    ...input.approvals.map((approval) => approval.updatedAt),
    ...input.auditTimeline.map((item) => item.createdAt),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;

export const deriveSelectedPolicyDecisions = (
  decisions: Decision[],
  policyId: string | null,
): Decision[] =>
  policyId === null ? [] : decisions.filter((decision) => decision.policyId === policyId);

export const deriveSelectedPolicyApprovals = (
  approvals: ApprovalTask[],
  decisions: Decision[],
): ApprovalTask[] => {
  const decisionIds = new Set(decisions.map((decision) => decision.id));
  return approvals.filter((approval) => decisionIds.has(approval.decisionId));
};

export const derivePolicyEffectivenessCards = (
  summaries: PolicyEffectivenessSummary[],
): GovernanceSummary["cards"] => {
  const latestSummary =
    summaries
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.measurementWindowEnd) - toTimestamp(left.measurementWindowEnd),
      )[0] ?? null;
  const previousSummary =
    summaries
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.measurementWindowEnd) - toTimestamp(left.measurementWindowEnd),
      )[1] ?? null;

  if (!latestSummary) {
    return [];
  }

  return [
    {
      id: "decision-count",
      label: "Decisions in window",
      value: formatNumber(latestSummary.decisionCount),
      helper: `Latest window ended ${formatDateTime(latestSummary.measurementWindowEnd)}.`,
      tone: latestSummary.decisionCount > 0 ? "positive" : "neutral",
      deltaLabel:
        previousSummary !== null
          ? `${formatNumber(latestSummary.decisionCount - previousSummary.decisionCount)} vs previous window`
          : null,
    },
    {
      id: "executed-decision-count",
      label: "Executed decisions",
      value: formatNumber(latestSummary.executedDecisionCount),
      helper: "Executed decisions recorded in the latest policy effectiveness summary.",
      tone: latestSummary.executedDecisionCount > 0 ? "positive" : "neutral",
      deltaLabel:
        previousSummary !== null
          ? `${formatNumber(
              latestSummary.executedDecisionCount - previousSummary.executedDecisionCount,
            )} vs previous window`
          : null,
    },
    {
      id: "stockout-avoidance-rate",
      label: "Stockout avoidance",
      value: formatPercent(latestSummary.stockoutAvoidanceRate),
      helper: "The latest persisted stockout avoidance rate for this policy.",
      tone:
        latestSummary.stockoutAvoidanceRate !== null && latestSummary.stockoutAvoidanceRate >= 0.5
          ? "positive"
          : "neutral",
    },
    {
      id: "override-rate",
      label: "Override rate",
      value: formatPercent(latestSummary.overrideRate),
      helper: "The latest override rate persisted by the outcomes policy effectiveness layer.",
      tone:
        latestSummary.overrideRate !== null && latestSummary.overrideRate > 0.25
          ? "warning"
          : "neutral",
    },
  ];
};

export const getPolicyScopeLabel = (policy: Policy): string =>
  `${formatPolicyType(policy.policyType)} decisions`;

export const getAutomationPostureLabel = (policy: Policy): string => {
  const automationTier = getPolicyAutomationTier(policy);
  return automationTier === "auto_execute" ? "More automated" : "Human-controlled";
};

export const buildPolicyRuleFactRows = (
  policy: Policy,
): Array<{ label: string; value: string }> => {
  if (policy.policyType === "replenishment") {
    const rules = policy.rulesJson as ReplenishmentPolicyRules;

    return [
      { label: "Automation tier", value: formatAutomationTier(rules.automationTier) },
      { label: "Forecast horizon", value: `${formatNumber(rules.forecastHorizonDays)} days` },
      { label: "Target days of cover", value: `${formatNumber(rules.targetDaysOfCover)} days` },
      { label: "Default lead time", value: `${formatNumber(rules.defaultLeadTimeDays)} days` },
      { label: "Lead time buffer", value: `${formatNumber(rules.leadTimeBufferDays)} days` },
      { label: "Use safety stock", value: rules.useSafetyStock ? "Yes" : "No" },
      { label: "Shortage buffer", value: formatNumber(rules.shortageBufferQty) },
      { label: "Demand spike multiplier", value: formatNumber(rules.demandSpikeMultiplier) },
    ];
  }

  if (policy.policyType === "allocation") {
    const rules = policy.rulesJson as AllocationPolicyRules;

    return [
      { label: "Automation tier", value: formatAutomationTier(rules.automationTier) },
      { label: "Shortage threshold", value: formatNumber(rules.shortageThresholdQty) },
      { label: "Prioritization", value: formatLabel(rules.prioritizationMode) },
      { label: "Max affected orders", value: formatNumber(rules.maxAffectedOrders) },
    ];
  }

  const rules = policy.rulesJson as ExceptionPolicyRules;

  return [
    { label: "Automation tier", value: formatAutomationTier(rules.automationTier) },
    { label: "Forecast horizon", value: `${formatNumber(rules.forecastHorizonDays)} days` },
    { label: "Lead-time drift threshold", value: `${formatNumber(rules.leadTimeDriftThresholdDays)} days` },
    { label: "Demand spike multiplier", value: formatNumber(rules.demandSpikeMultiplier) },
    { label: "Stockout risk cover days", value: `${formatNumber(rules.stockoutRiskCoverDays)} days` },
  ];
};

export const derivePolicyAuditItems = (
  timeline: SupportTimelineItem[],
  policyId: string | null,
): PolicyAuditItem[] =>
  timeline
    .filter((item) => {
      const metadata = item.metadata ?? {};
      const entityType = metadata.entityType;
      const entityId = metadata.entityId;
      const aggregateType = metadata.aggregateType;
      const aggregateId = metadata.aggregateId;
      const summary = item.summary;

      const isPolicyEvent =
        (typeof entityType === "string" && entityType === "Policy") ||
        (typeof aggregateType === "string" && aggregateType === "Policy") ||
        summary.startsWith("decision.policy.");

      if (!isPolicyEvent) {
        return false;
      }

      if (!policyId) {
        return true;
      }

      return entityId === policyId || aggregateId === policyId;
    })
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      correlationId: item.correlationId,
      sourceType: item.type,
      title: item.summary,
      description:
        item.type === "audit_event"
          ? "Governance audit evidence from the support timeline."
          : "Governance outbox evidence from the support timeline.",
      metadataPreview: truncateText(stringifyValue(item.metadata)),
    }))
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

export const getPolicyStatusTone = (
  status: PolicyStatus,
): { badgeClassName: string; textClassName: string } => {
  switch (status) {
    case "active":
      return {
        badgeClassName: "bg-pine/15 text-pine",
        textClassName: "text-pine",
      };
    case "draft":
      return {
        badgeClassName: "bg-sand/15 text-amber-700",
        textClassName: "text-amber-700",
      };
    case "archived":
      return {
        badgeClassName: "bg-black/6 text-steel",
        textClassName: "text-steel",
      };
  }
};

export const buildPolicyRelatedLinks = (policy: Policy) => ({
  decisions: "/decisions",
  workflow: "/workflow",
  outcomes: "/outcomes",
});

export const getPolicyEditorModeLabel = (
  selectedPolicy: Policy | null,
  forceCreateMode: boolean,
): { title: string; helper: string } => {
  if (selectedPolicy && selectedPolicy.status === "draft" && !forceCreateMode) {
    return {
      title: "Edit draft policy",
      helper:
        "This selected policy is still a draft, so the real backend allows updates to its name and rulesJson payload.",
    };
  }

  return {
    title: "Create policy draft",
    helper:
      "New policies are created as drafts. The backend remains authoritative for version uniqueness, automation-tier entitlement enforcement, and activation behavior.",
  };
};

export const validatePolicyDraft = (
  draft: PolicyEditorState,
): PolicyActionFeedback | null => {
  if (draft.name.trim().length === 0) {
    return {
      tone: "error",
      title: "Policy name required",
      message: "Provide a policy name before calling the real decisioning policy create or update route.",
      createdAt: new Date().toISOString(),
    };
  }

  if (!Number.isFinite(Number(draft.version)) || Number(draft.version) <= 0) {
    return {
      tone: "error",
      title: "Valid version required",
      message: "Policy version must be a positive number for the backend policy contract.",
      createdAt: new Date().toISOString(),
    };
  }

  return null;
};

export const getDecisionEvidenceLabel = (decision: Decision): string =>
  `${formatDecisionType(decision.decisionType)} | ${formatDecisionStatus(decision.status)} | ${formatAutomationTier(
    decision.automationTier,
  )}`;

export const toPolicyFilters = (params: PoliciesRouteParams): PolicyFilters => ({
  ...(params.policyType !== "all" ? { policyType: params.policyType } : {}),
  ...(params.status !== "all" ? { status: params.status } : {}),
});
