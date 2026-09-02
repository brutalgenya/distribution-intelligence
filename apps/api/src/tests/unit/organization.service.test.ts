import { type Prisma, RoleCode } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import { OrganizationService } from "../../modules/tenancy/organization.service.js";
import type { OrganizationMembershipRepository } from "../../modules/tenancy/membership.repository.js";
import type { OrganizationRepository } from "../../modules/tenancy/organization.repository.js";
import type { EntitlementRepository } from "../../modules/tenancy/entitlement.repository.js";
import type { RoleRepository } from "../../modules/tenancy/role.repository.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "cb6525c8-8f1e-41a7-a633-fef7e7db6977",
  activeOrganizationId: null,
  user: {
    id: "user-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("OrganizationService", () => {
  it("creates an organization, owner membership, audit record, and outbox event", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const organizationRepository = {
      create: vi.fn().mockResolvedValue({
        id: "organization-id",
        name: "Acme Distribution",
        slug: "acme-distribution",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as unknown as OrganizationRepository;

    const roleRepository = {
      findByCode: vi.fn().mockResolvedValue({
        id: "role-id",
        code: RoleCode.owner,
        name: "Owner",
        description: "Full tenant control",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as unknown as RoleRepository;

    const membershipRepository = {
      create: vi.fn().mockResolvedValue({
        id: "membership-id",
        organizationId: "organization-id",
        userId: "user-id",
        roleId: "role-id",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          id: "user-id",
          email: "owner@example.com",
          displayName: "Owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        role: {
          id: "role-id",
          code: RoleCode.owner,
          name: "Owner",
          description: "Full tenant control",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    } as unknown as OrganizationMembershipRepository;

    const entitlementRepository = {
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as EntitlementRepository;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new OrganizationService(
      {} as DbClient,
      transactionRunner,
      organizationRepository,
      roleRepository,
      membershipRepository,
      entitlementRepository,
      {
        initializeTrialSubscriptionInTransaction: vi.fn().mockResolvedValue(undefined),
        recordCurrentUsageInTransaction: vi.fn().mockResolvedValue(undefined),
      } as unknown as BillingEntitlementService,
      {} as AuthorizationService,
      auditEventRepository,
      outboxEventRepository,
      14,
    );

    const result = await service.createOrganization(requestContext, {
      name: "Acme Distribution",
      slug: "acme-distribution",
    });

    expect(result.organization.id).toBe("organization-id");
    expect(result.ownerMembership.role).toBe(RoleCode.owner);
    expect(vi.mocked(entitlementRepository.createMany)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
