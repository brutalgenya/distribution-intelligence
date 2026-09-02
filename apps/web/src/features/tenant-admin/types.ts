import type { BillingEntitlements, PlanSubscription } from "../activation/types";
import type { ApprovalTask, Decision } from "../decisions/types";
import type {
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
} from "../data-ops/types";
import type { MetricCardItem, MetricTone } from "../outcomes/types";
import type { SupportExecutionTask, SupportTimelineItem } from "../workflow/types";

export type {
  ApprovalTask,
  BillingEntitlements,
  Decision,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  PlanSubscription,
  SupportExecutionTask,
  SupportTimelineItem,
};

export type OrganizationRole = "owner" | "admin" | "operator" | "viewer";

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  role: OrganizationRole;
}

export interface OrganizationEntitlement {
  id: string;
  key: string;
  value: unknown;
  createdAt: string;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  token: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface InviteMemberInput {
  email: string;
  role: OrganizationRole;
}

export interface TenantAdminRouteParams {
  membershipId: string | null;
}

export interface TenantAdminSummary {
  title: string;
  tone: MetricTone;
  helper: string;
  cards: MetricCardItem[];
}

export type HandoffChecklistStatus = "complete" | "attention" | "blocked";

export interface PilotHandoffChecklistItem {
  id: string;
  title: string;
  status: HandoffChecklistStatus;
  evidence: string;
  helper: string;
  href: string;
  linkLabel: string;
}

export interface InviteMemberDraft {
  email: string;
  role: OrganizationRole;
}

export interface TenantAdminFeedback {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
}

export interface RoleCoverageItem {
  id: OrganizationRole;
  label: string;
  count: number;
  helper: string;
}

export interface AdministrativeAuditItem {
  id: string;
  createdAt: string;
  correlationId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  payloadPreview: string;
}
