import { formatLabel, formatNumber } from "../../lib/utils/format";
import { buildApprovalGovernanceHref } from "../approval-governance/route";
import { formatApprovalStatus, formatOverrideType } from "../approval-governance/selectors";
import { buildBuyerActionsHref } from "../buyer-actions/route";
import { buildDataOpsHref } from "../data-ops/route";
import { formatForecastScopeType } from "../data-ops/selectors";
import { buildIntegrationsHref } from "../integrations/route";
import { formatSyncStatus, formatSyncType } from "../integrations/selectors";
import { buildInvestigationHref } from "../investigation/route";
import { buildSupplyExecutionHref } from "../supply-execution/route";
import { formatPurchaseOrderStatus } from "../supply-execution/selectors";
import { buildSupportActionsHref } from "../support-actions/route";
import { findCurrentMembership } from "../tenant-admin/selectors";
import type {
  ActivationChecklistItem,
  ActivationSummary,
  ApprovalRow,
  BillingEntitlements,
  BuyerPurchaseOrderQueueRow,
  CommandCenterActionItem,
  CommandCenterAudienceKey,
  CommandCenterGlobalSummary,
  CommandCenterRecentActivityItem,
  CommandCenterRoleFocus,
  CommandCenterSnapshot,
  GovernanceSummary,
  IntegrationConnectionRow,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  MetricCardItem,
  MetricTone,
  NextBestAction,
  OnboardingReadinessSummary,
  OrganizationMembership,
  OverrideRow,
  PlanSubscription,
  PurchaseOrderQueueRow,
  RiskHotspot,
  SalesImportRun,
  SupportActionableItem,
  SupplierCoverageRow,
  TenantAdminSummary,
  WorkerStatus,
} from "./types";

const toneRank: Record<MetricTone, number> = {
  critical: 0,
  warning: 1,
  neutral: 2,
  positive: 3,
};

const toTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

const firstCardValue = (cards: MetricCardItem[], id: string): string =>
  cards.find((card) => card.id === id)?.value ?? "Not available";

const combineTones = (tones: MetricTone[]): MetricTone =>
  tones.reduce<MetricTone>(
    (current, tone) => (toneRank[tone] < toneRank[current] ? tone : current),
    "positive",
  );

const latestTimestamp = (values: Array<string | null | undefined>): string | null =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;

const formatSubscriptionState = (subscription: PlanSubscription | null): string =>
  subscription ? formatLabel(subscription.status) : "Missing";

const isCommerciallyActive = (subscription: PlanSubscription | null): boolean =>
  subscription?.status === "active" || subscription?.status === "trialing";

const getCurrentRoleLabel = (membership: OrganizationMembership | null): string =>
  membership ? formatLabel(membership.role) : "Unknown role";

const getHighlightLimit = (items: string[], limit = 4): string[] => items.slice(0, limit);

const getActionHref = (action: NextBestAction): string => action.href ?? "/activation";

const getAudiencePriority = (
  orderedAudiences: CommandCenterAudienceKey[],
  audience: CommandCenterAudienceKey | "shared",
): number => {
  if (audience === "shared") {
    return -1;
  }

  return orderedAudiences.indexOf(audience);
};

export const deriveRoleFocus = (input: {
  memberships: OrganizationMembership[];
  userId: string;
}): CommandCenterRoleFocus => {
  const currentMembership = findCurrentMembership(input.memberships, input.userId);

  if (currentMembership?.role === "owner" || currentMembership?.role === "admin") {
    return {
      focus: "admin",
      currentRoleLabel: getCurrentRoleLabel(currentMembership),
      orderedAudiences: ["admin", "operator", "buyer"],
      title: "Admin and commercial readiness surfaces come first",
      helper:
        "The current session is an owner/admin role, so this landing page prioritizes billing, onboarding, access readiness, and governance posture before day-to-day queues.",
    };
  }

  if (currentMembership?.role === "operator") {
    return {
      focus: "operator",
      currentRoleLabel: getCurrentRoleLabel(currentMembership),
      orderedAudiences: ["operator", "buyer", "admin"],
      title: "Operator load and intervention surfaces come first",
      helper:
        "The current session is an operator role, so the overview emphasizes approval backlog, risk hotspots, support urgency, and supply follow-through.",
    };
  }

  return {
    focus: "shared",
    currentRoleLabel: getCurrentRoleLabel(currentMembership),
    orderedAudiences: ["admin", "operator", "buyer"],
    title: "Shared cross-functional overview",
    helper:
      "The backend does not expose a buyer-specific role or a dedicated landing-page profile, so the page stays universally useful while still grouping admin, operator, and buyer evidence separately.",
  };
};

export const deriveGlobalHealthSummary = (input: {
  activationSummary: ActivationSummary;
  onboardingReadiness: OnboardingReadinessSummary;
  subscription: PlanSubscription | null;
  connections: IntegrationConnectionRow[];
  approvals: ApprovalRow[];
  hotspots: RiskHotspot[];
  actionableQueue: SupportActionableItem[];
  buyerQueueRows: BuyerPurchaseOrderQueueRow[];
  latestEvidenceAt: string | null;
}): CommandCenterGlobalSummary => {
  const activeConnections = input.connections.filter((connection) => connection.status === "active");
  const pendingApprovals = input.approvals.filter((approval) => approval.status === "pending");
  const criticalHotspots = input.hotspots.filter((hotspot) => hotspot.severity === "critical");
  const delayedOrders = input.buyerQueueRows.filter(
    (row) => row.purchaseOrder.status === "delayed",
  );

  const tone = combineTones([
    input.activationSummary.tone,
    input.onboardingReadiness.tone,
    criticalHotspots.length > 0 ? "critical" : "positive",
    input.actionableQueue.length > 0 ? "warning" : "positive",
    delayedOrders.length > 0 ? "warning" : "positive",
  ]);

  const title =
    tone === "critical"
      ? "Commercial or operational blockers need attention"
      : tone === "warning"
        ? "Platform is active with visible operating load"
        : "Tenant looks commercially and operationally healthy";

  return {
    title,
    tone,
    helper:
      "This summary is composed from the existing activation, integrations, workflow, support, outcomes, governance, and supply slices. It only summarizes persisted backend evidence those workspaces already expose.",
    freshnessAt: input.latestEvidenceAt,
    cards: [
      {
        id: "activation-steps",
        label: "Activation steps",
        value: firstCardValue(input.activationSummary.cards, "completed-steps"),
        helper: "Commercial and onboarding milestone completion from the activation workspace.",
        tone: input.activationSummary.tone,
      },
      {
        id: "subscription-state",
        label: "Commercial status",
        value: formatSubscriptionState(input.subscription),
        helper: input.subscription
          ? `${input.subscription.plan.name} plan is currently persisted.`
          : "No subscription is currently persisted for this tenant.",
        tone: isCommerciallyActive(input.subscription) ? "positive" : "critical",
      },
      {
        id: "data-ready",
        label: "Active connections",
        value: formatNumber(activeConnections.length),
        helper: `${formatNumber(input.connections.length)} total persisted connection(s).`,
        tone: activeConnections.length > 0 ? "positive" : "warning",
      },
      {
        id: "pending-approvals",
        label: "Pending approvals",
        value: formatNumber(pendingApprovals.length),
        helper: "Approval tasks currently waiting on human review.",
        tone: pendingApprovals.length > 0 ? "warning" : "positive",
      },
      {
        id: "critical-hotspots",
        label: "Critical hotspots",
        value: formatNumber(criticalHotspots.length),
        helper: "Inventory positions currently showing critical risk from persisted position, incident, or anomaly evidence.",
        tone: criticalHotspots.length > 0 ? "critical" : "positive",
      },
      {
        id: "support-urgency",
        label: "Recovery items ready",
        value: formatNumber(input.actionableQueue.length),
        helper: "Support queue items with a real backend remediation path already exposed in the product.",
        tone: input.actionableQueue.length > 0 ? "warning" : "positive",
      },
    ],
  };
};

export const deriveAdminSnapshot = (input: {
  roleFocus: CommandCenterRoleFocus;
  activationSummary: ActivationSummary;
  activationChecklist: ActivationChecklistItem[];
  onboardingReadiness: OnboardingReadinessSummary;
  organizationSummary: TenantAdminSummary;
  governanceSummary: GovernanceSummary;
  currentMembership: OrganizationMembership | null;
  subscription: PlanSubscription | null;
  connections: IntegrationConnectionRow[];
  memberships: OrganizationMembership[];
  latestEvidenceAt: string | null;
}): CommandCenterSnapshot => {
  const activeConnections = input.connections.filter((connection) => connection.status === "active");
  const ownerAdminCount = input.memberships.filter(
    (membership) => membership.role === "owner" || membership.role === "admin",
  ).length;
  const activePolicies = firstCardValue(input.governanceSummary.cards, "active-policies");
  const incompleteChecklistCount = input.activationChecklist.filter(
    (item) => item.status !== "complete",
  ).length;
  const tone = combineTones([
    input.activationSummary.tone,
    input.organizationSummary.tone,
    input.governanceSummary.tone,
    input.onboardingReadiness.tone,
  ]);

  return {
    key: "admin",
    eyebrow: "Section B",
    title: "Admin / owner snapshot",
    description:
      "Commercial readiness, onboarding control, access coverage, and governance posture for owners or admins responsible for getting the tenant ready for real usage.",
    tone,
    currentRolePriority: input.roleFocus.focus === "admin",
    freshnessAt: input.latestEvidenceAt,
    cards: [
      {
        id: "admin-subscription",
        label: "Subscription state",
        value: formatSubscriptionState(input.subscription),
        helper: input.subscription
          ? `${input.subscription.plan.name} plan is the current commercially persisted plan.`
          : "Commercial activation is still blocked because no subscription is persisted.",
        tone: isCommerciallyActive(input.subscription) ? "positive" : "critical",
      },
      {
        id: "admin-connections",
        label: "Active connections",
        value: formatNumber(activeConnections.length),
        helper: input.onboardingReadiness.statusLabel,
        tone: activeConnections.length > 0 ? "positive" : "warning",
      },
      {
        id: "admin-access",
        label: "Owners and admins",
        value: formatNumber(ownerAdminCount),
        helper: "Current owner/admin coverage from persisted organization memberships.",
        tone: ownerAdminCount > 0 ? "positive" : "critical",
      },
      {
        id: "admin-policies",
        label: "Active policies",
        value: activePolicies,
        helper: "Current governance coverage from active persisted decision policies.",
        tone: input.governanceSummary.tone,
      },
    ],
    highlights: getHighlightLimit([
      `${input.activationSummary.title}.`,
      `${input.organizationSummary.title}.`,
      `${input.onboardingReadiness.statusLabel}.`,
      incompleteChecklistCount > 0
        ? `${formatNumber(incompleteChecklistCount)} activation checklist step(s) still need attention.`
        : "The activation checklist currently has no blocked or attention-required steps.",
      input.currentMembership
        ? `Current session role is ${formatLabel(input.currentMembership.role)}.`
        : "The current user does not have a visible membership row in the tenant-admin read model.",
    ]),
    links: [
      { label: "Open activation", href: "/activation" },
      { label: "Open data connections", href: buildIntegrationsHref() },
      { label: "Open tenant admin", href: "/tenant-admin" },
      { label: "Open policies", href: "/policies" },
    ],
  };
};

export const deriveOperatorSnapshot = (input: {
  roleFocus: CommandCenterRoleFocus;
  approvals: ApprovalRow[];
  hotspots: RiskHotspot[];
  anomalyHighlights: Array<{ scopeLabel: string }>;
  overrides: OverrideRow[];
  actionableQueue: SupportActionableItem[];
  interventionPatterns: Array<{ policyName: string }>;
  latestEvidenceAt: string | null;
}): CommandCenterSnapshot => {
  const pendingApprovals = input.approvals.filter((approval) => approval.status === "pending");
  const criticalHotspots = input.hotspots.filter((hotspot) => hotspot.severity === "critical");
  const firstPendingApproval = pendingApprovals[0] ?? null;
  const firstHotspot = input.hotspots[0] ?? null;
  const firstActionableItem = input.actionableQueue[0] ?? null;
  const leadingPattern = input.interventionPatterns[0] ?? null;
  const tone =
    criticalHotspots.length > 0 || input.actionableQueue.length > 0
      ? "critical"
      : pendingApprovals.length > 0 || input.overrides.length > 0 || input.anomalyHighlights.length > 0
        ? "warning"
        : "positive";

  return {
    key: "operator",
    eyebrow: "Section C",
    title: "Operator snapshot",
    description:
      "Workflow load, risk hotspots, investigation candidates, manual-intervention evidence, and immediate recovery pressure for day-to-day platform operators.",
    tone,
    currentRolePriority: input.roleFocus.focus === "operator",
    freshnessAt: input.latestEvidenceAt,
    cards: [
      {
        id: "operator-pending-approvals",
        label: "Pending approvals",
        value: formatNumber(pendingApprovals.length),
        helper: "Approval tasks currently waiting on human review.",
        tone: pendingApprovals.length > 0 ? "warning" : "positive",
      },
      {
        id: "operator-critical-risk",
        label: "Critical hotspots",
        value: formatNumber(criticalHotspots.length),
        helper: "Critical inventory risk positions from the risk-and-outcomes surface.",
        tone: criticalHotspots.length > 0 ? "critical" : "positive",
      },
      {
        id: "operator-manual-interventions",
        label: "Manual interventions",
        value: formatNumber(input.overrides.length),
        helper: "Explicit operator override records currently exposed by the backend.",
        tone: input.overrides.length > 0 ? "warning" : "positive",
      },
      {
        id: "operator-support-actions",
        label: "Recovery items ready",
        value: formatNumber(input.actionableQueue.length),
        helper: "Execution, forecast, sync, or failed-record items already surfaced in support actions.",
        tone: input.actionableQueue.length > 0 ? "critical" : "positive",
      },
    ],
    highlights: getHighlightLimit([
      firstPendingApproval
        ? `Oldest visible pending approval has waited ${firstPendingApproval.waitLabel}.`
        : "No pending approval backlog is currently visible.",
      firstHotspot
        ? `Top hotspot: ${firstHotspot.scopeLabel}.`
        : "No risk hotspot is currently visible in the outcomes surface.",
      firstActionableItem
        ? `Top remediation item: ${firstActionableItem.title} on ${firstActionableItem.primaryReference}.`
        : "No support action is currently queued for immediate backend-backed remediation.",
      leadingPattern
        ? `Governance exceptions are clustering around ${leadingPattern.policyName}.`
        : "No clustered governance exception pattern is currently visible.",
      input.anomalyHighlights[0]
        ? `Latest anomaly worth investigation: ${input.anomalyHighlights[0].scopeLabel}.`
        : "No anomaly highlight is currently exposed for operator investigation.",
    ]),
    links: [
      { label: "Open workflow", href: "/workflow" },
      { label: "Open risk & outcomes", href: "/outcomes" },
      ...(firstHotspot
        ? [
            {
              label: "Investigate top hotspot",
              href: buildInvestigationHref(firstHotspot.skuId, firstHotspot.locationId),
            },
          ]
        : []),
      { label: "Open support actions", href: buildSupportActionsHref() },
      { label: "Open approval governance", href: buildApprovalGovernanceHref() },
    ],
  };
};

export const deriveBuyerSnapshot = (input: {
  roleFocus: CommandCenterRoleFocus;
  buyerQueueRows: BuyerPurchaseOrderQueueRow[];
  supplyQueueRows: PurchaseOrderQueueRow[];
  supplierCoverageRows: SupplierCoverageRow[];
  latestEvidenceAt: string | null;
}): CommandCenterSnapshot => {
  const delayedRows = input.buyerQueueRows.filter((row) => row.purchaseOrder.status === "delayed");
  const receiptReadyRows = input.buyerQueueRows.filter((row) =>
    row.availableActions.includes("receive"),
  );
  const openRows = input.supplyQueueRows.filter(
    (row) => row.purchaseOrder.status !== "received" && row.purchaseOrder.status !== "cancelled",
  );
  const constrainedSuppliers = input.supplierCoverageRows.filter(
    (row) => row.delayedPurchaseOrderCount > 0,
  );
  const firstDelayedRow = delayedRows[0] ?? null;
  const firstReceiptReadyRow = receiptReadyRows[0] ?? null;
  const topConstraint = constrainedSuppliers[0] ?? null;
  const tone =
    delayedRows.length > 0
      ? "critical"
      : receiptReadyRows.length > 0 || openRows.length > 0
        ? "warning"
        : "positive";

  return {
    key: "buyer",
    eyebrow: "Section D",
    title: "Buyer snapshot",
    description:
      "Supply follow-through, receiving backlog, and supplier-side constraints for buyers or operators turning planned remediation into actual replenishment progress.",
    tone,
    currentRolePriority: false,
    freshnessAt: input.latestEvidenceAt,
    cards: [
      {
        id: "buyer-open-orders",
        label: "Open purchase orders",
        value: formatNumber(openRows.length),
        helper: "Open supply orders still waiting on submit, receipt, or closure signals.",
        tone: openRows.length > 0 ? "warning" : "positive",
      },
      {
        id: "buyer-delayed-orders",
        label: "Delayed purchase orders",
        value: formatNumber(delayedRows.length),
        helper: "Orders currently persisted in delayed status.",
        tone: delayedRows.length > 0 ? "critical" : "positive",
      },
      {
        id: "buyer-receipt-ready",
        label: "Receipt-ready orders",
        value: formatNumber(receiptReadyRows.length),
        helper: "Submitted, delayed, or partial orders that can take receipt input now.",
        tone: receiptReadyRows.length > 0 ? "warning" : "positive",
      },
      {
        id: "buyer-constrained-suppliers",
        label: "Constrained suppliers",
        value: formatNumber(constrainedSuppliers.length),
        helper: "Suppliers currently showing delayed PO exposure in the visible supply queue.",
        tone: constrainedSuppliers.length > 0 ? "warning" : "positive",
      },
    ],
    highlights: getHighlightLimit([
      firstDelayedRow
        ? `Most urgent delayed PO: ${firstDelayedRow.purchaseOrder.poNumber} (${formatPurchaseOrderStatus(firstDelayedRow.purchaseOrder.status)}).`
        : "No delayed purchase order is currently visible.",
      firstReceiptReadyRow
        ? `Next receipt-ready PO: ${firstReceiptReadyRow.purchaseOrder.poNumber}.`
        : "No purchase order is currently ready for receipt input.",
      topConstraint
        ? `Highest supplier constraint: ${topConstraint.supplier.name} with ${formatNumber(topConstraint.delayedPurchaseOrderCount)} delayed order(s).`
        : "No supplier delay cluster is currently visible.",
      openRows.length > 0
        ? `${formatNumber(openRows.length)} open purchase order(s) still need follow-through.`
        : "No open purchase order backlog is currently visible.",
    ]),
    links: [
      { label: "Open supply execution", href: buildSupplyExecutionHref() },
      { label: "Open buyer actions", href: buildBuyerActionsHref() },
    ],
  };
};

export const deriveNextBestActions = (input: {
  roleFocus: CommandCenterRoleFocus;
  activationNextAction: NextBestAction;
  approvals: ApprovalRow[];
  hotspots: RiskHotspot[];
  actionableQueue: SupportActionableItem[];
  buyerQueueRows: BuyerPurchaseOrderQueueRow[];
  failedRecords: IntegrationFailedRecord[];
}): CommandCenterActionItem[] => {
  const pendingApproval = input.approvals.find((approval) => approval.status === "pending") ?? null;
  const hotspot = input.hotspots[0] ?? null;
  const actionable = input.actionableQueue[0] ?? null;
  const delayedOrder = input.buyerQueueRows.find(
    (row) => row.purchaseOrder.status === "delayed",
  ) ?? null;
  const receiptReadyOrder = input.buyerQueueRows.find((row) =>
    row.availableActions.includes("receive"),
  ) ?? null;

  const candidates: Array<CommandCenterActionItem & { priority: number }> = [];

  if (input.activationNextAction.kind !== "none") {
    candidates.push({
      id: "activation-next-step",
      audience: "admin",
      title: input.activationNextAction.title,
      description: input.activationNextAction.description,
      label: input.activationNextAction.buttonLabel ?? "Open activation",
      href: getActionHref(input.activationNextAction),
      tone: input.activationNextAction.tone,
      priority: input.activationNextAction.tone === "critical" ? 0 : 3,
    });
  }

  if (input.failedRecords.length > 0) {
    candidates.push({
      id: "failed-records-blocker",
      audience: "admin",
      title: "Resolve onboarding blockers",
      description: `${formatNumber(input.failedRecords.length)} unresolved failed record(s) are still blocking clean inbound data.`,
      label: "Open data connections",
      href: buildIntegrationsHref(),
      tone: "critical",
      priority: 1,
    });
  }

  if (actionable) {
    candidates.push({
      id: `actionable-${actionable.key}`,
      audience:
        actionable.sourceType === "sync" || actionable.sourceType === "failed_record"
          ? "admin"
          : "operator",
      title: actionable.availableActionLabel ?? "Inspect backend action",
      description: actionable.errorSummary
        ? `${actionable.title} on ${actionable.primaryReference}. ${actionable.errorSummary}`
        : `${actionable.title} on ${actionable.primaryReference} is already exposing a backend-supported remediation path.`,
      label: "Open support actions",
      href: buildSupportActionsHref({
        executionId: actionable.executionId,
        forecastJobId: actionable.forecastJobId,
        integrationConnectionId: actionable.integrationConnectionId,
        syncRunId: actionable.syncRunId,
        skuId: actionable.skuId,
        locationId: actionable.locationId,
      }),
      tone: actionable.sourceType === "execution" ? "critical" : "warning",
      priority: actionable.sourceType === "execution" ? 1 : 2,
    });
  }

  if (pendingApproval) {
    candidates.push({
      id: `pending-approval-${pendingApproval.id}`,
      audience: "operator",
      title: "Review the pending approval queue",
      description: `Approval task ${pendingApproval.id} has been waiting ${pendingApproval.waitLabel} for human review.`,
      label: "Open approval governance",
      href: buildApprovalGovernanceHref({
        approvalTaskId: pendingApproval.id,
        status: "pending",
      }),
      tone: "warning",
      priority: 2,
    });
  }

  if (hotspot) {
    candidates.push({
      id: `hotspot-${hotspot.key}`,
      audience: "operator",
      title: "Investigate the top risk hotspot",
      description: `${hotspot.scopeLabel} is currently ${formatLabel(hotspot.severity)} risk with persisted incident or inventory-threshold evidence.`,
      label: "Open investigation",
      href: buildInvestigationHref(hotspot.skuId, hotspot.locationId),
      tone: hotspot.severity === "critical" ? "critical" : "warning",
      priority: hotspot.severity === "critical" ? 1 : 3,
    });
  }

  if (delayedOrder) {
    candidates.push({
      id: `delayed-po-${delayedOrder.purchaseOrder.id}`,
      audience: "buyer",
      title: "Follow through on delayed replenishment",
      description: `${delayedOrder.purchaseOrder.poNumber} for ${delayedOrder.supplier?.name ?? delayedOrder.purchaseOrder.supplierId} is currently delayed.`,
      label: "Open buyer actions",
      href: buildBuyerActionsHref({
        purchaseOrderId: delayedOrder.purchaseOrder.id,
        supplierId: delayedOrder.purchaseOrder.supplierId,
      }),
      tone: "warning",
      priority: 3,
    });
  } else if (receiptReadyOrder) {
    candidates.push({
      id: `receipt-po-${receiptReadyOrder.purchaseOrder.id}`,
      audience: "buyer",
      title: "Post the next receipt",
      description: `${receiptReadyOrder.purchaseOrder.poNumber} is ready for cumulative receipt input through the real supply mutation route.`,
      label: "Open buyer actions",
      href: buildBuyerActionsHref({
        purchaseOrderId: receiptReadyOrder.purchaseOrder.id,
        supplierId: receiptReadyOrder.purchaseOrder.supplierId,
        action: "receive",
      }),
      tone: "warning",
      priority: 4,
    });
  }

  return candidates
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      const toneDelta = toneRank[left.tone] - toneRank[right.tone];
      if (toneDelta !== 0) {
        return toneDelta;
      }

      return (
        getAudiencePriority(input.roleFocus.orderedAudiences, left.audience) -
        getAudiencePriority(input.roleFocus.orderedAudiences, right.audience)
      );
    })
    .filter(
      (candidate, index, items) =>
        items.findIndex((item) => item.href === candidate.href && item.title === candidate.title) === index,
    )
    .slice(0, 5)
    .map(({ priority, ...item }) => item);
};

export const deriveRecentActivity = (input: {
  syncRuns: IntegrationSyncRun[];
  connections: IntegrationConnectionRow[];
  forecastJobs: Array<{
    id: string;
    status: string;
    scopeType: "organization" | "sku" | "sku_location";
    createdAt: string;
    completedAt: string | null;
  }>;
  approvals: ApprovalRow[];
  overrides: OverrideRow[];
  actionableQueue: SupportActionableItem[];
  buyerQueueRows: BuyerPurchaseOrderQueueRow[];
  auditItems: Array<{ id: string; createdAt: string; eventType: string; summary: string }>;
  salesImportRuns: SalesImportRun[];
  workers: WorkerStatus[];
}): CommandCenterRecentActivityItem[] => {
  const connectionNameById = new Map(
    input.connections.map((connection) => [connection.id, connection.name] as const),
  );
  const latestSync =
    input.syncRuns
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.completedAt ?? right.startedAt) -
          toTimestamp(left.completedAt ?? left.startedAt),
      )[0] ?? null;
  const latestForecastJob =
    input.forecastJobs
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.completedAt ?? right.createdAt) -
          toTimestamp(left.completedAt ?? left.createdAt),
      )[0] ?? null;
  const latestApproval =
    input.approvals
      .slice()
      .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt))[0] ?? null;
  const latestOverride =
    input.overrides
      .slice()
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))[0] ?? null;
  const latestBuyerOrder =
    input.buyerQueueRows
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.purchaseOrder.updatedAt) -
          toTimestamp(left.purchaseOrder.updatedAt),
      )[0] ?? null;
  const latestAudit = input.auditItems[0] ?? null;
  const latestSalesImport =
    input.salesImportRuns
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.completedAt ?? right.startedAt) -
          toTimestamp(left.completedAt ?? left.startedAt),
      )[0] ?? null;
  const firstActionable = input.actionableQueue[0] ?? null;
  const busiestWorker =
    input.workers
      .slice()
      .sort((left, right) => toTimestamp(right.lastRunAt) - toTimestamp(left.lastRunAt))[0] ?? null;
  const items: CommandCenterRecentActivityItem[] = [];

  if (latestSync) {
    items.push({
      id: `recent-sync-${latestSync.id}`,
      categoryLabel: "Sync",
      title: `${formatSyncType(latestSync.syncType)} ${formatSyncStatus(latestSync.status).toLowerCase()}`,
      description: `${
        connectionNameById.get(latestSync.integrationConnectionId) ?? latestSync.integrationConnectionId
      } processed ${formatNumber(latestSync.processedCount)} record(s) with ${formatNumber(latestSync.failureCount)} failure(s).`,
      timestamp: latestSync.completedAt ?? latestSync.startedAt,
      href: buildIntegrationsHref({
        integrationConnectionId: latestSync.integrationConnectionId,
        syncRunId: latestSync.id,
      }),
      linkLabel: "Open connection",
      tone:
        latestSync.status === "failed" || latestSync.status === "partial"
          ? "critical"
          : latestSync.status === "completed"
            ? "positive"
            : "warning",
    });
  }

  if (latestForecastJob) {
    items.push({
      id: `recent-forecast-${latestForecastJob.id}`,
      categoryLabel: "Forecast",
      title: `Forecast job ${formatLabel(latestForecastJob.status).toLowerCase()}`,
      description: `${formatForecastScopeType(latestForecastJob.scopeType)} scope for job ${latestForecastJob.id}.`,
      timestamp: latestForecastJob.completedAt ?? latestForecastJob.createdAt,
      href: buildDataOpsHref({ forecastJobId: latestForecastJob.id }),
      linkLabel: "Open data & forecast ops",
      tone:
        latestForecastJob.status === "failed"
          ? "critical"
          : latestForecastJob.status === "completed"
            ? "positive"
            : "warning",
    });
  }

  if (latestApproval) {
    items.push({
      id: `recent-approval-${latestApproval.id}`,
      categoryLabel: "Approval",
      title: `Approval ${formatApprovalStatus(latestApproval.status).toLowerCase()}`,
      description: latestApproval.decision
        ? `Decision ${latestApproval.decision.id} is linked to ${formatLabel(latestApproval.decision.decisionType)} workflow.`
        : `Approval task ${latestApproval.id} is linked to decision ${latestApproval.decisionId}.`,
      timestamp: latestApproval.updatedAt,
      href: buildApprovalGovernanceHref({ approvalTaskId: latestApproval.id }),
      linkLabel: "Open approval governance",
      tone:
        latestApproval.status === "rejected"
          ? "critical"
          : latestApproval.status === "pending"
            ? "warning"
            : "positive",
    });
  }

  if (latestOverride) {
    items.push({
      id: `recent-override-${latestOverride.id}`,
      categoryLabel: "Override",
      title: `${formatOverrideType(latestOverride.overrideType)} recorded`,
      description: latestOverride.decision
        ? `Decision ${latestOverride.decision.id} now has direct manual intervention evidence.`
        : "A workflow override record is now visible through the governance surface.",
      timestamp: latestOverride.createdAt,
      href: buildApprovalGovernanceHref({
        decisionId: latestOverride.decision?.id ?? null,
        overrideType: latestOverride.overrideType,
      }),
      linkLabel: "Open override evidence",
      tone: "warning",
    });
  }

  if (latestBuyerOrder) {
    items.push({
      id: `recent-po-${latestBuyerOrder.purchaseOrder.id}`,
      categoryLabel: "Supply",
      title: `${latestBuyerOrder.purchaseOrder.poNumber} updated`,
      description: `${latestBuyerOrder.supplier?.name ?? latestBuyerOrder.purchaseOrder.supplierId} is ${formatPurchaseOrderStatus(
        latestBuyerOrder.purchaseOrder.status,
      ).toLowerCase()}.`,
      timestamp: latestBuyerOrder.purchaseOrder.updatedAt,
      href: buildSupplyExecutionHref({
        purchaseOrderId: latestBuyerOrder.purchaseOrder.id,
        supplierId: latestBuyerOrder.purchaseOrder.supplierId,
      }),
      linkLabel: "Open supply execution",
      tone:
        latestBuyerOrder.purchaseOrder.status === "delayed"
          ? "critical"
          : latestBuyerOrder.purchaseOrder.status === "partially_received"
            ? "warning"
            : "neutral",
    });
  }

  if (latestAudit) {
    items.push({
      id: `recent-audit-${latestAudit.id}`,
      categoryLabel: "Admin audit",
      title: latestAudit.eventType,
      description: latestAudit.summary,
      timestamp: latestAudit.createdAt,
      href: "/tenant-admin",
      linkLabel: "Open tenant admin",
      tone: "neutral",
    });
  }

  if (latestSalesImport) {
    items.push({
      id: `recent-sales-import-${latestSalesImport.id}`,
      categoryLabel: "Demand import",
      title: `Sales import ${formatLabel(latestSalesImport.status).toLowerCase()}`,
      description: `${formatNumber(latestSalesImport.acceptedRows)} accepted row(s), ${formatNumber(latestSalesImport.rejectedRows)} rejected row(s).`,
      timestamp: latestSalesImport.completedAt ?? latestSalesImport.startedAt,
      href: buildDataOpsHref(),
      linkLabel: "Open data & forecast ops",
      tone: latestSalesImport.status === "failed" ? "warning" : "positive",
    });
  }

  if (firstActionable) {
    items.push({
      id: `recent-actionable-${firstActionable.key}`,
      categoryLabel: "Support",
      title: firstActionable.availableActionLabel ?? "Support item exposed",
      description: `${firstActionable.title} on ${firstActionable.primaryReference}.`,
      timestamp: firstActionable.updatedAt ?? firstActionable.createdAt,
      href: buildSupportActionsHref({
        executionId: firstActionable.executionId,
        forecastJobId: firstActionable.forecastJobId,
        integrationConnectionId: firstActionable.integrationConnectionId,
        syncRunId: firstActionable.syncRunId,
        skuId: firstActionable.skuId,
        locationId: firstActionable.locationId,
      }),
      linkLabel: "Open support actions",
      tone: firstActionable.sourceType === "execution" ? "critical" : "warning",
    });
  }

  if (busiestWorker) {
    items.push({
      id: `recent-worker-${busiestWorker.workerType}`,
      categoryLabel: "Worker",
      title: `${formatLabel(busiestWorker.workerType)} worker ran`,
      description: `Last status ${busiestWorker.lastStatus ?? "unknown"} with backlog ${formatNumber(
        busiestWorker.retryBacklog,
      )}.`,
      timestamp: busiestWorker.lastRunAt ?? new Date().toISOString(),
      href: buildSupportActionsHref(),
      linkLabel: "Open support actions",
      tone:
        busiestWorker.lastStatus === "failed" || busiestWorker.deadLetterCount > 0
          ? "warning"
          : "neutral",
    });
  }

  return items
    .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp))
    .slice(0, 8);
};

export const deriveLatestCommandCenterEvidenceAt = (input: {
  subscription: PlanSubscription | null;
  billingEntitlements: BillingEntitlements | null;
  activationConnections: IntegrationConnectionRow[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
  hotspots: RiskHotspot[];
  approvals: ApprovalRow[];
  overrides: OverrideRow[];
  buyerQueueRows: BuyerPurchaseOrderQueueRow[];
  workerStatuses: WorkerStatus[];
  latestTenantEvidenceAt: string | null;
}): string | null =>
  latestTimestamp([
    input.subscription?.updatedAt ?? null,
    input.billingEntitlements?.usageWindow.end ?? null,
    ...input.activationConnections.map((connection) => connection.updatedAt),
    ...input.syncRuns.map((syncRun) => syncRun.completedAt ?? syncRun.updatedAt),
    ...input.failedRecords.map((record) => record.createdAt),
    ...input.hotspots.map((hotspot) => hotspot.freshnessAt),
    ...input.approvals.map((approval) => approval.updatedAt),
    ...input.overrides.map((override) => override.createdAt),
    ...input.buyerQueueRows.map((row) => row.purchaseOrder.updatedAt),
    ...input.workerStatuses.map((worker) => worker.lastRunAt),
    input.latestTenantEvidenceAt,
  ]);
