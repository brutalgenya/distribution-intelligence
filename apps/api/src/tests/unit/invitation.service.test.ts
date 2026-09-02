import { type Prisma, RoleCode } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { InvitationService } from "../../modules/tenancy/invitation.service.js";
import type { RoleRepository } from "../../modules/tenancy/role.repository.js";
import type { UserRepository } from "../../modules/identity/user.repository.js";
import type { OrganizationMembershipRepository } from "../../modules/tenancy/membership.repository.js";
import type { OrganizationInvitationRepository } from "../../modules/tenancy/invitation.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "fcd3e56a-9628-4b3a-99d0-e7d17f8cc802",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("InvitationService", () => {
  it("creates an invitation and writes audit and outbox events", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const roleRepository = {
      findByCode: vi.fn().mockResolvedValue({
        id: "admin-role-id",
        code: RoleCode.admin,
        name: "Admin",
        description: "Can manage users and organization data",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as unknown as RoleRepository;

    const userRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepository;

    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(null),
    } as unknown as OrganizationMembershipRepository;

    const invitationRepository = {
      findPendingByOrganizationAndEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (_db, data: { email: string; organizationId: string; token: string }) => ({
        id: "invitation-id",
        organizationId: data.organizationId,
        email: data.email,
        token: data.token,
        roleId: "admin-role-id",
        invitedByUserId: "owner-id",
        acceptedByUserId: null,
        status: "pending",
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
        acceptedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        organization: {
          id: data.organizationId,
          name: "Acme",
          slug: "acme",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        role: {
          id: "admin-role-id",
          code: RoleCode.admin,
          name: "Admin",
          description: "Can manage users and organization data",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      })),
    } as unknown as OrganizationInvitationRepository;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new InvitationService(
      transactionRunner,
      roleRepository,
      userRepository,
      membershipRepository,
      invitationRepository,
      {
        ensureNewMembershipAllowedInTransaction: vi.fn().mockResolvedValue(undefined),
        recordCurrentUsageInTransaction: vi.fn().mockResolvedValue(undefined),
      } as unknown as BillingEntitlementService,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
      24,
    );

    const result = await service.inviteMember(requestContext, "organization-id", {
      email: "admin@example.com",
      role: RoleCode.admin,
    });

    expect(result.email).toBe("admin@example.com");
    expect(result.role).toBe(RoleCode.admin);
    expect(result.token).toMatch(/^[0-9a-f-]{36}$/i);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
