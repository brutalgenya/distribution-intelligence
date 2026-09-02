import { RoleCode } from "@prisma/client";

export type OrganizationAction =
  | "organization.invite_member"
  | "organization.memberships.read"
  | "organization.entitlements.read"
  | "catalog.read"
  | "catalog.write"
  | "inventory.read"
  | "inventory.write"
  | "demand.read"
  | "demand.write"
  | "forecasting.read"
  | "forecasting.write"
  | "supply.read"
  | "supply.write"
  | "decisioning.read"
  | "decisioning.write"
  | "ai.read"
  | "ai.write"
  | "outcomes.read"
  | "outcomes.write"
  | "workflow.read"
  | "workflow.write"
  | "billing.read"
  | "billing.write"
  | "integrations.read"
  | "integrations.write"
  | "support.read"
  | "support.write";

export const organizationPermissionMatrix: Record<RoleCode, ReadonlySet<OrganizationAction>> = {
  [RoleCode.owner]: new Set<OrganizationAction>([
    "organization.invite_member",
    "organization.memberships.read",
    "organization.entitlements.read",
    "catalog.read",
    "catalog.write",
    "inventory.read",
    "inventory.write",
    "demand.read",
    "demand.write",
    "forecasting.read",
    "forecasting.write",
    "supply.read",
    "supply.write",
    "decisioning.read",
    "decisioning.write",
    "ai.read",
    "ai.write",
    "outcomes.read",
    "outcomes.write",
    "workflow.read",
    "workflow.write",
    "billing.read",
    "billing.write",
    "integrations.read",
    "integrations.write",
    "support.read",
    "support.write",
  ]),
  [RoleCode.admin]: new Set<OrganizationAction>([
    "organization.invite_member",
    "organization.memberships.read",
    "organization.entitlements.read",
    "catalog.read",
    "catalog.write",
    "inventory.read",
    "inventory.write",
    "demand.read",
    "demand.write",
    "forecasting.read",
    "forecasting.write",
    "supply.read",
    "supply.write",
    "decisioning.read",
    "decisioning.write",
    "ai.read",
    "ai.write",
    "outcomes.read",
    "outcomes.write",
    "workflow.read",
    "workflow.write",
    "billing.read",
    "billing.write",
    "integrations.read",
    "integrations.write",
    "support.read",
    "support.write",
  ]),
  [RoleCode.operator]: new Set<OrganizationAction>([
    "organization.memberships.read",
    "organization.entitlements.read",
    "catalog.read",
    "catalog.write",
    "inventory.read",
    "inventory.write",
    "demand.read",
    "demand.write",
    "forecasting.read",
    "forecasting.write",
    "supply.read",
    "supply.write",
    "decisioning.read",
    "decisioning.write",
    "ai.read",
    "ai.write",
    "outcomes.read",
    "outcomes.write",
    "workflow.read",
    "workflow.write",
    "billing.read",
    "integrations.read",
    "integrations.write",
    "support.read",
    "support.write",
  ]),
  [RoleCode.viewer]: new Set<OrganizationAction>([
    "organization.entitlements.read",
    "catalog.read",
    "inventory.read",
    "demand.read",
    "forecasting.read",
    "supply.read",
    "decisioning.read",
    "ai.read",
    "outcomes.read",
    "workflow.read",
    "integrations.read",
  ]),
};
