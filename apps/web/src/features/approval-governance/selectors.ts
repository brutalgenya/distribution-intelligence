import {
  formatDateTime,
  formatLabel,
  formatNumber,
  formatPercent,
} from "../../lib/utils/format";
import {
  formatAutomationTier,
  formatDecisionStatus,
  formatDecisionType,
  summarizeDecision,
} from "../decisions/presentation";
import type {
  ApprovalTask,
  ApprovalGovernanceRouteParams,
  ApprovalRow,
  Decision,
  DecisionOutcome,
  GovernanceAuditItem,
  GovernanceFrictionSummary,
  InterventionPatternRow,
  OperatorOverride,
  OverrideRow,
  Policy,
  PolicyEffectivenessSummary,
  SupportExecutionTask,
  SupportTimelineItem,
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

const isGovernanceTimelineItem = (item: SupportTimelineItem): boolean => {
  const summary = item.summary.toLowerCase();
  const entityType = typeof item.metadata.entityType === "string" ? item.metadata.entityType : null;
  const aggregateType =
    typeof item.metadata.aggregateType === "string" ? item.metadata.aggregateType : null;

  return (
    summary.includes("workflow.approval") ||
    summary.includes("workflow.override") ||
    entityType === "ApprovalTask" ||
    entityType === "OperatorOverride" ||
    aggregateType === "ApprovalTask" ||
    aggregateType === "OperatorOverride"
  );
};

const getApprovalStatusRank = (status: ApprovalRow["status"]): number => {
  switch (status) {
    case "pending":
      return 0;
    case "rejected":
      return 1;
    case "approved":
      return 2;
    case "cancelled":
      return 3;
  }
};

const getPolicyName = (policy: Policy | null): string =>
  policy ? `${policy.name} v${policy.version}` : "Policy not exposed";

const getDecisionForOverride = (
  override: OperatorOverride,
  decisionsById: Map<string, Decision>,
  executionsById: Map<string, SupportExecutionTask>,
): Decision | null => {
  if (override.decisionId) {
    return decisionsById.get(override.decisionId) ?? null;
  }

  if (override.executionTaskId) {
    const execution = executionsById.get(override.executionTaskId) ?? null;
    return execution ? decisionsById.get(execution.decisionId) ?? null : null;
  }

  return null;
};

export const formatApprovalStatus = (value: ApprovalRow["status"]): string => formatLabel(value);

export const formatOverrideType = (value: OperatorOverride["overrideType"]): string =>
  formatLabel(value);

export const getApprovalStatusTone = (
  status: ApprovalRow["status"],
): { badgeClassName: string; accentClassName: string } => {
  switch (status) {
    case "pending":
      return {
        badgeClassName: "bg-sand/15 text-amber-700",
        accentClassName: "text-amber-700",
      };
    case "approved":
      return {
        badgeClassName: "bg-pine/15 text-pine",
        accentClassName: "text-pine",
      };
    case "rejected":
      return {
        badgeClassName: "bg-red-100 text-red-700",
        accentClassName: "text-red-700",
      };
    case "cancelled":
      return {
        badgeClassName: "bg-black/6 text-steel",
        accentClassName: "text-steel",
      };
  }
};

export const getOverrideTone = (
  overrideType: OperatorOverride["overrideType"],
): { badgeClassName: string; accentClassName: string } => {
  switch (overrideType) {
    case "manual_approve":
      return {
        badgeClassName: "bg-pine/15 text-pine",
        accentClassName: "text-pine",
      };
    case "manual_reject":
    case "manual_cancel_execution":
      return {
        badgeClassName: "bg-red-100 text-red-700",
        accentClassName: "text-red-700",
      };
    case "manual_close_exception":
      return {
        badgeClassName: "bg-sand/15 text-amber-700",
        accentClassName: "text-amber-700",
      };
    case "manual_retry":
      return {
        badgeClassName: "bg-sky-100 text-sky-700",
        accentClassName: "text-sky-700",
      };
    case "manual_request_execution":
    case "manual_request_approval":
      return {
        badgeClassName: "bg-black/6 text-steel",
        accentClassName: "text-steel",
      };
  }
};

export const formatWaitLabel = (minutes: number | null): string => {
  if (minutes === null) {
    return "Not available";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

export const calculateApprovalWaitMinutes = (
  approval: Pick<ApprovalRow, "requestedAt" | "decidedAt">,
): number | null => {
  const requestedAt = toTimestamp(approval.requestedAt);
  if (!requestedAt) {
    return null;
  }

  const endTimestamp = approval.decidedAt ? toTimestamp(approval.decidedAt) : Date.now();
  if (!endTimestamp || endTimestamp < requestedAt) {
    return null;
  }

  return Math.round((endTimestamp - requestedAt) / 60_000);
};

export const buildApprovalRow = (
  approval: ApprovalTask,
  decisions: Decision[],
  policies: Policy[],
  overrides: OperatorOverride[],
): ApprovalRow => {
  const decision = decisions.find((item) => item.id === approval.decisionId) ?? null;
  const policy = decision ? policies.find((item) => item.id === decision.policyId) ?? null : null;
  const waitMinutes = calculateApprovalWaitMinutes(approval);

  return {
    ...approval,
    decision,
    policy,
    waitMinutes,
    waitLabel: formatWaitLabel(waitMinutes),
    relatedOverrideCount: overrides.filter((item) => item.decisionId === approval.decisionId).length,
  };
};

export const buildApprovalRows = (
  approvals: ApprovalTask[],
  decisions: Decision[],
  policies: Policy[],
  overrides: OperatorOverride[],
): ApprovalRow[] =>
  approvals
    .map((approval) => buildApprovalRow(approval, decisions, policies, overrides))
    .sort((left, right) => {
      const statusDelta = getApprovalStatusRank(left.status) - getApprovalStatusRank(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      if (left.status === "pending" && right.status === "pending") {
        return (right.waitMinutes ?? 0) - (left.waitMinutes ?? 0);
      }

      return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
    });

export const filterApprovalRows = (
  rows: ApprovalRow[],
  filters: Pick<ApprovalGovernanceRouteParams, "decisionType" | "policyId" | "decisionId">,
): ApprovalRow[] =>
  rows.filter((row) => {
    if (filters.decisionId && row.decisionId !== filters.decisionId) {
      return false;
    }

    if (filters.policyId && row.policy?.id !== filters.policyId) {
      return false;
    }

    if (filters.decisionType !== "all" && row.decision?.decisionType !== filters.decisionType) {
      return false;
    }

    return true;
  });

export const deriveGovernanceFrictionSummary = (input: {
  approvals: ApprovalRow[];
  overrides: OperatorOverride[];
  policySummaries: PolicyEffectivenessSummary[];
}): GovernanceFrictionSummary => {
  const pendingApprovals = input.approvals.filter((approval) => approval.status === "pending");
  const approvedRecently = input.approvals.filter(
    (approval) =>
      approval.status === "approved" &&
      toTimestamp(approval.decidedAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000,
  );
  const rejectedApprovals = input.approvals.filter((approval) => approval.status === "rejected");
  const averagePendingWaitMinutes =
    pendingApprovals.length > 0
      ? Math.round(
          pendingApprovals.reduce((total, approval) => total + (approval.waitMinutes ?? 0), 0) /
            pendingApprovals.length,
        )
      : null;
  const latestOverrideRate =
    input.policySummaries
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.measurementWindowEnd) - toTimestamp(left.measurementWindowEnd),
      )[0]?.overrideRate ?? null;

  const tone =
    pendingApprovals.length >= 5 || (averagePendingWaitMinutes ?? 0) >= 24 * 60
      ? "critical"
      : pendingApprovals.length > 0 || rejectedApprovals.length > 0 || input.overrides.length > 0
        ? "warning"
        : "positive";

  const title =
    tone === "critical"
      ? "Human review is creating visible automation drag"
      : tone === "warning"
        ? "Human review is actively shaping automation"
        : "Approval friction is currently contained";

  return {
    title,
    tone,
    helper:
      "These cards are derived from persisted approval-task state, operator override records, and the latest policy-effectiveness override-rate summaries the backend already exposes.",
    cards: [
      {
        id: "pending-approvals",
        label: "Pending approvals",
        value: formatNumber(pendingApprovals.length),
        helper: "Approval tasks currently waiting on human review.",
        tone: pendingApprovals.length > 0 ? "warning" : "positive",
        deltaLabel:
          pendingApprovals.length > 0
            ? `Oldest waiting ${pendingApprovals[0]?.waitLabel ?? "Not available"}`
            : null,
      },
      {
        id: "approved-recently",
        label: "Approved in 7 days",
        value: formatNumber(approvedRecently.length),
        helper: "Recently approved decisions show how much workflow throughput still depends on humans.",
        tone: approvedRecently.length > 0 ? "neutral" : "positive",
      },
      {
        id: "manual-interventions",
        label: "Manual interventions",
        value: formatNumber(input.overrides.length),
        helper: "Direct operator override records persisted by the workflow module.",
        tone: input.overrides.length > 0 ? "warning" : "positive",
      },
      {
        id: "override-rate",
        label: "Latest override rate",
        value: formatPercent(latestOverrideRate),
        helper: "Most recent backend-computed policy effectiveness override rate.",
        tone:
          latestOverrideRate !== null && latestOverrideRate >= 0.25
            ? "warning"
            : latestOverrideRate === null
              ? "neutral"
              : "positive",
        deltaLabel:
          averagePendingWaitMinutes !== null
            ? `Average pending wait ${formatWaitLabel(averagePendingWaitMinutes)}`
            : null,
      },
    ],
  };
};

export const deriveLatestGovernanceEvidenceAt = (input: {
  approvals: ApprovalRow[];
  overrides: OperatorOverride[];
  policySummaries: PolicyEffectivenessSummary[];
  auditTimeline: SupportTimelineItem[];
  decisionOutcomes: DecisionOutcome[];
}): string | null =>
  [
    ...input.approvals.map((approval) => approval.updatedAt),
    ...input.overrides.map((override) => override.createdAt),
    ...input.policySummaries.map((summary) => summary.updatedAt),
    ...input.auditTimeline.map((item) => item.createdAt),
    ...input.decisionOutcomes.map((outcome) => outcome.computedAt),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;

export const deriveOverrideRows = (
  overrides: OperatorOverride[],
  decisions: Decision[],
  policies: Policy[],
  executions: SupportExecutionTask[],
): OverrideRow[] => {
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
  const executionsById = new Map(executions.map((execution) => [execution.id, execution]));
  const policiesById = new Map(policies.map((policy) => [policy.id, policy]));

  return overrides
    .map((override) => {
      const decision = getDecisionForOverride(override, decisionsById, executionsById);
      const execution = override.executionTaskId
        ? executionsById.get(override.executionTaskId) ?? null
        : null;
      const policy = decision ? policiesById.get(decision.policyId) ?? null : null;

      return {
        ...override,
        decision,
        execution,
        policy,
      } satisfies OverrideRow;
    })
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
};

export const filterOverrideRows = (
  rows: OverrideRow[],
  filters: Pick<
    ApprovalGovernanceRouteParams,
    "overrideType" | "decisionType" | "policyId" | "decisionId"
  >,
): OverrideRow[] =>
  rows.filter((row) => {
    if (filters.overrideType !== "all" && row.overrideType !== filters.overrideType) {
      return false;
    }

    if (filters.decisionId && row.decision?.id !== filters.decisionId) {
      return false;
    }

    if (filters.policyId && row.policy?.id !== filters.policyId) {
      return false;
    }

    if (filters.decisionType !== "all" && row.decision?.decisionType !== filters.decisionType) {
      return false;
    }

    return true;
  });

export const deriveInterventionPatternRows = (input: {
  policies: Policy[];
  decisions: Decision[];
  approvals: ApprovalRow[];
  overrides: OverrideRow[];
  policySummaries: PolicyEffectivenessSummary[];
}): InterventionPatternRow[] => {
  const patterns = new Map<string, InterventionPatternRow>();
  const latestSummaryByPolicyId = new Map<string, PolicyEffectivenessSummary>();

  input.policySummaries
    .slice()
    .sort(
      (left, right) =>
        toTimestamp(right.measurementWindowEnd) - toTimestamp(left.measurementWindowEnd),
    )
    .forEach((summary) => {
      if (!latestSummaryByPolicyId.has(summary.policyId)) {
        latestSummaryByPolicyId.set(summary.policyId, summary);
      }
    });

  const ensurePattern = (policyId: string | null): InterventionPatternRow => {
    const key = policyId ?? "unlinked";
    const existing = patterns.get(key);

    if (existing) {
      return existing;
    }

    const policy = policyId ? input.policies.find((item) => item.id === policyId) ?? null : null;
    const latestSummary = policyId ? latestSummaryByPolicyId.get(policyId) ?? null : null;
    const created: InterventionPatternRow = {
      key,
      policyId,
      policyName: policy ? policy.name : "No linked policy",
      policyTypeLabel: policy ? formatLabel(policy.policyType) : "Not available",
      decisionCount: 0,
      approvalCount: 0,
      pendingApprovalCount: 0,
      rejectedApprovalCount: 0,
      overrideCount: 0,
      manualApproveCount: 0,
      manualRejectCount: 0,
      overrideRate: latestSummary?.overrideRate ?? null,
      latestEffectivenessAt: latestSummary?.measurementWindowEnd ?? null,
    };

    patterns.set(key, created);
    return created;
  };

  input.decisions.forEach((decision) => {
    const pattern = ensurePattern(decision.policyId);
    pattern.decisionCount += 1;
  });

  input.approvals.forEach((approval) => {
    const pattern = ensurePattern(approval.decision?.policyId ?? null);
    pattern.approvalCount += 1;

    if (approval.status === "pending") {
      pattern.pendingApprovalCount += 1;
    }

    if (approval.status === "rejected") {
      pattern.rejectedApprovalCount += 1;
    }
  });

  input.overrides.forEach((override) => {
    const pattern = ensurePattern(override.policy?.id ?? null);
    pattern.overrideCount += 1;

    if (override.overrideType === "manual_approve") {
      pattern.manualApproveCount += 1;
    }

    if (override.overrideType === "manual_reject") {
      pattern.manualRejectCount += 1;
    }
  });

  return Array.from(patterns.values()).sort((left, right) => {
    if (right.pendingApprovalCount !== left.pendingApprovalCount) {
      return right.pendingApprovalCount - left.pendingApprovalCount;
    }

    if (right.overrideCount !== left.overrideCount) {
      return right.overrideCount - left.overrideCount;
    }

    if (right.rejectedApprovalCount !== left.rejectedApprovalCount) {
      return right.rejectedApprovalCount - left.rejectedApprovalCount;
    }

    return right.decisionCount - left.decisionCount;
  });
};

export const deriveGovernanceAuditItems = (
  timeline: SupportTimelineItem[],
  filters: { decisionId?: string | null; policyId?: string | null } = {},
): GovernanceAuditItem[] =>
  timeline
    .filter((item) => {
      if (!isGovernanceTimelineItem(item)) {
        return false;
      }

      if (filters.decisionId) {
        const metadataDecisionId =
          typeof item.metadata.entityId === "string" && item.metadata.entityType === "Decision"
            ? item.metadata.entityId
            : typeof item.metadata.decisionId === "string"
              ? item.metadata.decisionId
              : typeof item.metadata.payload === "object" &&
                  item.metadata.payload !== null &&
                  "decisionId" in item.metadata.payload &&
                  typeof (item.metadata.payload as Record<string, unknown>).decisionId === "string"
                ? ((item.metadata.payload as Record<string, unknown>).decisionId as string)
                : null;

        if (metadataDecisionId !== filters.decisionId) {
          return false;
        }
      }

      if (filters.policyId) {
        const payload =
          typeof item.metadata.payload === "object" && item.metadata.payload !== null
            ? (item.metadata.payload as Record<string, unknown>)
            : null;
        const metadataPolicyId =
          typeof item.metadata.policyId === "string"
            ? item.metadata.policyId
            : payload && typeof payload.policyId === "string"
              ? payload.policyId
              : null;

        if (metadataPolicyId !== filters.policyId) {
          return false;
        }
      }

      return true;
    })
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      correlationId: item.correlationId,
      title: item.summary,
      sourceType: item.type,
      description:
        item.type === "audit_event"
          ? "Persisted governance audit evidence from approval or override activity."
          : item.type === "outbox_event"
            ? "Outbox evidence emitted for approval or override state changes."
            : "Related governance evidence from the support timeline.",
      metadataPreview: truncateText(stringifyValue(item.metadata)),
    }))
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

export const deriveLatestDecisionOutcome = (
  outcomes: DecisionOutcome[],
): DecisionOutcome | null =>
  outcomes
    .slice()
    .sort((left, right) => toTimestamp(right.computedAt) - toTimestamp(left.computedAt))[0] ?? null;

export const deriveRelatedExecutions = (
  executions: SupportExecutionTask[],
  decisionId: string | null,
): SupportExecutionTask[] =>
  decisionId === null
    ? []
    : executions
        .filter((execution) => execution.decisionId === decisionId)
        .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt));

export const deriveSelectedOverrideRows = (
  overrides: OverrideRow[],
  decisionId: string | null,
  executionIds: string[],
): OverrideRow[] => {
  if (decisionId === null && executionIds.length === 0) {
    return [];
  }

  const executionIdSet = new Set(executionIds);
  return overrides.filter(
    (override) =>
      override.decision?.id === decisionId ||
      (override.executionTaskId !== null && executionIdSet.has(override.executionTaskId)),
  );
};

export const getApprovalQueueHelper = (filters: {
  status: ApprovalGovernanceRouteParams["status"];
  decisionType: ApprovalGovernanceRouteParams["decisionType"];
}): string => {
  const statusLabel =
    filters.status === "all" ? "all approval statuses" : `${formatApprovalStatus(filters.status)} only`;
  const decisionTypeLabel =
    filters.decisionType === "all"
      ? "all linked decision types"
      : `${formatDecisionType(filters.decisionType)} decisions only`;

  return `Status filtering uses the real approvals query contract; decision-type filtering is applied client-side from the linked persisted decisions. Currently showing ${statusLabel} and ${decisionTypeLabel}.`;
};

export const getInterventionDetailSummary = (input: {
  approval: ApprovalRow | null;
  decision: Decision | null;
  policy: Policy | null;
  overrides: OverrideRow[];
  latestOutcome: DecisionOutcome | null;
}): string => {
  if (input.approval && input.approval.status === "pending") {
    return `This decision has been waiting ${input.approval.waitLabel} for human review under ${getPolicyName(
      input.policy,
    )}.`;
  }

  if (input.overrides.length > 0) {
    return `${formatNumber(input.overrides.length)} direct operator override record(s) are linked to this decision or its related executions.`;
  }

  if (input.latestOutcome) {
    return `Latest linked outcome status is ${formatLabel(input.latestOutcome.outcomeStatus)}. No additional override records are currently exposed for this decision.`;
  }

  if (input.decision) {
    return `Decision ${input.decision.id} is persisted with ${formatDecisionStatus(input.decision.status)} status, but no deeper human-intervention evidence is exposed beyond its approval and override records.`;
  }

  return "Select an approval task or deep-link a decision into this workspace to inspect specific governance evidence.";
};

export const getDecisionEvidenceLabel = (decision: Decision): string =>
  `${formatDecisionType(decision.decisionType)} | ${formatDecisionStatus(decision.status)} | ${formatAutomationTier(
    decision.automationTier,
  )}`;

export const getOverrideReasonPreview = (reason: string): string =>
  reason.trim().length > 0 ? truncateText(reason.trim(), 140) : "No reason captured";

export const getDecisionSummary = (decision: Decision | null): string =>
  decision ? summarizeDecision(decision) : "Decision detail unavailable";

export const getPolicyPatternHelper = (pattern: InterventionPatternRow): string => {
  const rateLabel =
    pattern.overrideRate === null
      ? "No backend override-rate summary yet"
      : `${formatPercent(pattern.overrideRate)} override rate`;

  return `${rateLabel} | ${formatNumber(pattern.pendingApprovalCount)} pending approvals | ${formatNumber(
    pattern.overrideCount,
  )} manual override records`;
};

export const getAuditMetadataLabel = (item: GovernanceAuditItem): string =>
  `${formatLabel(item.sourceType)} | ${formatDateTime(item.createdAt)}`;
