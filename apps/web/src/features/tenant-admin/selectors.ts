import { formatDateTime, formatLabel, formatNumber } from "../../lib/utils/format";
import { buildIntegrationsHref } from "../integrations/route";
import type {
  AdministrativeAuditItem,
  ApprovalTask,
  BillingEntitlements,
  Decision,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  OrganizationEntitlement,
  OrganizationMembership,
  OrganizationRole,
  PilotHandoffChecklistItem,
  PlanSubscription,
  RoleCoverageItem,
  SupportExecutionTask,
  SupportTimelineItem,
  TenantAdminSummary,
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

const truncateText = (value: string, maxLength = 180): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

const isCommerciallyActive = (subscription: PlanSubscription | null): boolean =>
  subscription?.status === "active" || subscription?.status === "trialing";

export const organizationRoleOptions: OrganizationRole[] = [
  "owner",
  "admin",
  "operator",
  "viewer",
];

export const formatOrganizationRole = (value: OrganizationRole): string =>
  formatLabel(value);

export const sortMemberships = (
  memberships: OrganizationMembership[],
): OrganizationMembership[] => {
  const roleOrder: Record<OrganizationRole, number> = {
    owner: 0,
    admin: 1,
    operator: 2,
    viewer: 3,
  };

  return memberships
    .slice()
    .sort((left, right) => {
      const roleDifference = roleOrder[left.role] - roleOrder[right.role];
      if (roleDifference !== 0) {
        return roleDifference;
      }

      const nameDifference = left.user.displayName.localeCompare(right.user.displayName);
      if (nameDifference !== 0) {
        return nameDifference;
      }

      return left.user.email.localeCompare(right.user.email);
    });
};

export const findCurrentMembership = (
  memberships: OrganizationMembership[],
  userId: string,
): OrganizationMembership | null =>
  memberships.find((membership) => membership.user.id === userId) ?? null;

export const findSelectedMembership = (
  memberships: OrganizationMembership[],
  membershipId: string | null,
  userId: string,
): OrganizationMembership | null => {
  if (membershipId) {
    return memberships.find((membership) => membership.id === membershipId) ?? null;
  }

  return findCurrentMembership(memberships, userId) ?? memberships[0] ?? null;
};

export const canInviteMembers = (
  membership: OrganizationMembership | null,
): boolean => membership?.role === "owner" || membership?.role === "admin";

export const deriveRoleCoverage = (
  memberships: OrganizationMembership[],
): RoleCoverageItem[] =>
  organizationRoleOptions.map((role) => {
    const count = memberships.filter((membership) => membership.role === role).length;

    return {
      id: role,
      label: formatOrganizationRole(role),
      count,
      helper:
        count > 0
          ? `${formatNumber(count)} current membership(s) use the ${formatOrganizationRole(role).toLowerCase()} role code.`
          : `No current memberships use the ${formatOrganizationRole(role).toLowerCase()} role code.`,
    };
  });

export const deriveOrganizationSummary = (input: {
  memberships: OrganizationMembership[];
  subscription: PlanSubscription | null;
  billingEntitlements: BillingEntitlements | null;
  currentMembership: OrganizationMembership | null;
}): TenantAdminSummary => {
  const adminCount = input.memberships.filter(
    (membership) => membership.role === "owner" || membership.role === "admin",
  ).length;
  const operatorCount = input.memberships.filter(
    (membership) => membership.role === "operator",
  ).length;
  const currentLimit = input.billingEntitlements?.limits?.users ?? null;
  const tone =
    adminCount === 0 || (currentLimit?.exceeded ?? false)
      ? "critical"
      : operatorCount === 0 || !isCommerciallyActive(input.subscription)
        ? "warning"
        : "positive";

  return {
    title:
      tone === "positive"
        ? "Access posture looks ready for handoff"
        : tone === "critical"
          ? "Access readiness is blocked"
          : "Access readiness needs attention",
    tone,
    helper:
      "This summary is derived from real membership rows, current billing state, and the current session role. The backend does not expose a dedicated organization profile or settings read model here.",
    cards: [
      {
        id: "members-total",
        label: "Current memberships",
        value: formatNumber(input.memberships.length),
        helper:
          "The memberships API only exposes current memberships, so this view treats each row as active access.",
        tone: input.memberships.length > 0 ? "neutral" : "warning",
      },
      {
        id: "admins-total",
        label: "Owners and admins",
        value: formatNumber(adminCount),
        helper:
          "At least one owner or admin is recommended before handing the tenant to real operators.",
        tone: adminCount > 0 ? "positive" : "critical",
      },
      {
        id: "operators-total",
        label: "Operators",
        value: formatNumber(operatorCount),
        helper:
          "Operator coverage is shown only from current role assignments because there is no separate role catalog endpoint.",
        tone: operatorCount > 0 ? "positive" : "warning",
      },
      {
        id: "user-capacity",
        label: "User seats remaining",
        value: currentLimit !== null ? formatNumber(currentLimit.remaining) : "Not exposed",
        helper:
          currentLimit !== null
            ? `Used ${formatNumber(currentLimit.used)} of ${formatNumber(currentLimit.limit)} seats in the current billing usage window.`
            : "Billing entitlement limits are unavailable for the current session.",
        tone:
          currentLimit === null
            ? "warning"
            : currentLimit.exceeded
              ? "critical"
              : currentLimit.remaining > 0
                ? "positive"
                : "warning",
      },
    ],
  };
};

export const deriveLatestEvidenceAt = (input: {
  memberships: OrganizationMembership[];
  entitlements: OrganizationEntitlement[];
  subscription: PlanSubscription | null;
  connections: IntegrationConnection[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
  decisions: Decision[];
  approvals: ApprovalTask[];
  executions: SupportExecutionTask[];
  auditTimeline: SupportTimelineItem[];
}): string | null =>
  [
    ...input.memberships.map((membership) => membership.createdAt),
    ...input.entitlements.map((entitlement) => entitlement.createdAt),
    input.subscription?.updatedAt ?? null,
    ...input.connections.map((connection) => connection.updatedAt),
    ...input.syncRuns.map((syncRun) => syncRun.completedAt ?? syncRun.updatedAt),
    ...input.failedRecords.map((record) => record.createdAt),
    ...input.decisions.map((decision) => decision.updatedAt),
    ...input.approvals.map((approval) => approval.updatedAt),
    ...input.executions.map((execution) => execution.updatedAt),
    ...input.auditTimeline.map((item) => item.createdAt),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;

export const derivePilotHandoffChecklist = (input: {
  memberships: OrganizationMembership[];
  subscription: PlanSubscription | null;
  connections: IntegrationConnection[];
  syncRuns: IntegrationSyncRun[];
  decisions: Decision[];
  approvals: ApprovalTask[];
  executions: SupportExecutionTask[];
  failedRecords: IntegrationFailedRecord[];
}): PilotHandoffChecklistItem[] => {
  const ownerOrAdminCount = input.memberships.filter(
    (membership) => membership.role === "owner" || membership.role === "admin",
  ).length;
  const operatorCount = input.memberships.filter(
    (membership) => membership.role === "operator",
  ).length;
  const latestSuccessfulSync =
    input.syncRuns
      .filter((syncRun) => syncRun.status === "completed")
      .sort(
        (left, right) =>
          toTimestamp(right.completedAt ?? right.startedAt) -
          toTimestamp(left.completedAt ?? left.startedAt),
      )[0] ?? null;
  const workflowReady = input.approvals.length > 0 || input.executions.length > 0;

  return [
    {
      id: "owner-admin-coverage",
      title: "Owner or admin coverage",
      status: ownerOrAdminCount > 0 ? "complete" : "blocked",
      evidence:
        ownerOrAdminCount > 0
          ? `${formatNumber(ownerOrAdminCount)} owner/admin membership(s) are currently persisted.`
          : "No owner or admin membership is currently visible through the memberships read model.",
      helper: "This is derived only from persisted membership role codes.",
      href: "/activation",
      linkLabel: "Open activation",
    },
    {
      id: "operator-coverage",
      title: "Operator coverage",
      status: operatorCount > 0 ? "complete" : "attention",
      evidence:
        operatorCount > 0
          ? `${formatNumber(operatorCount)} operator membership(s) are currently persisted.`
          : "No operator membership is currently visible, so day-to-day operational ownership may still be unclear.",
      helper:
        "The backend does not expose a separate staffing or handoff model, so this step is based on role assignments alone.",
      href: "/activation",
      linkLabel: "Review activation",
    },
    {
      id: "billing-active",
      title: "Billing is commercially active",
      status: isCommerciallyActive(input.subscription) ? "complete" : "blocked",
      evidence: input.subscription
        ? `Subscription is ${formatLabel(input.subscription.status)} on ${input.subscription.plan.name}.`
        : "No subscription is currently persisted for this tenant.",
      helper: "Commercial readiness stays grounded in the real billing subscription state.",
      href: "/activation",
      linkLabel: "Open activation",
    },
    {
      id: "data-connected",
      title: "Data connection exists",
      status:
        input.connections.some((connection) => connection.status === "active")
          ? "complete"
          : input.connections.length > 0
            ? "attention"
            : "blocked",
      evidence:
        input.connections.some((connection) => connection.status === "active")
          ? `${formatNumber(
              input.connections.filter((connection) => connection.status === "active").length,
            )} active connection(s) are persisted.`
          : input.connections.length > 0
            ? "Connections exist, but none are currently active."
            : "No integration connection is currently persisted.",
      helper:
        "The checklist links to the integration onboarding workspace because that is where data onboarding control already exists.",
      href: buildIntegrationsHref(),
      linkLabel: "Open data connections",
    },
    {
      id: "first-sync",
      title: "First successful sync completed",
      status:
        latestSuccessfulSync !== null
          ? "complete"
          : input.syncRuns.length > 0
            ? "attention"
            : "blocked",
      evidence:
        latestSuccessfulSync !== null
          ? `${formatLabel(latestSuccessfulSync.syncType)} completed ${formatDateTime(
              latestSuccessfulSync.completedAt,
            )}.`
          : "No successful sync run is currently persisted.",
      helper:
        "This uses the integrations sync history directly, without inventing extra onboarding rules.",
      href: buildIntegrationsHref(),
      linkLabel: "Open sync history",
    },
    {
      id: "decision-surface",
      title: "Decisioning is active",
      status: input.decisions.length > 0 ? "complete" : "blocked",
      evidence:
        input.decisions.length > 0
          ? `${formatNumber(input.decisions.length)} decision record(s) are currently visible.`
          : "No decision record is currently persisted.",
      helper: "Decision readiness is based on the live decision list only.",
      href: "/decisions",
      linkLabel: "Open decision inbox",
    },
    {
      id: "workflow-surface",
      title: "Workflow or execution evidence exists",
      status: workflowReady ? "complete" : "blocked",
      evidence:
        input.executions.length > 0
          ? `${formatNumber(input.executions.length)} execution task(s) are visible.`
          : input.approvals.length > 0
            ? `${formatNumber(input.approvals.length)} approval task(s) are visible.`
            : "No approval or execution evidence is currently persisted.",
      helper:
        input.failedRecords.length > 0
          ? `${formatNumber(input.failedRecords.length)} unresolved failed record(s) still suggest the tenant may need operational cleanup before handoff.`
          : "Workflow readiness is confirmed only by persisted approval or execution records.",
      href: "/workflow",
      linkLabel: "Open workflow operations",
    },
  ];
};

const parseAuditEventType = (summary: string): string =>
  summary.includes(" on ") ? summary.split(" on ")[0] ?? summary : summary;

const getStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const deriveAdministrativeAuditItems = (
  timeline: SupportTimelineItem[],
): AdministrativeAuditItem[] =>
  timeline
    .filter((item) => item.type === "audit_event")
    .map((item) => {
      const eventType = parseAuditEventType(item.summary);
      const metadata = item.metadata ?? {};

      return {
        id: item.id,
        createdAt: item.createdAt,
        correlationId: item.correlationId,
        eventType,
        entityType: getStringValue(metadata.entityType),
        entityId: getStringValue(metadata.entityId),
        summary: item.summary,
        payloadPreview: truncateText(stringifyValue(metadata.payload), 220),
      } satisfies AdministrativeAuditItem;
    })
    .filter((item) => item.eventType.startsWith("organization."))
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

export const serializeEntitlementValue = (value: unknown): string =>
  truncateText(stringifyValue(value), 120);
