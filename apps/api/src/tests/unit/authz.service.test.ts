import { RoleCode } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ForbiddenError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { MembershipWithUserAndRole } from "../../modules/tenancy/membership.repository.js";
import { OrganizationMembershipRepository } from "../../modules/tenancy/membership.repository.js";

const buildMembership = (roleCode: RoleCode): MembershipWithUserAndRole => ({
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
    code: roleCode,
    name: roleCode,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
});

const requestContext: RequestContext = {
  correlationId: "92dd5bb8-4037-4a0a-9475-d59f02bc2f64",
  activeOrganizationId: "organization-id",
  user: {
    id: "user-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("AuthorizationService", () => {
  it("allows owner, admin, and operator roles to mutate supply data", async () => {
    for (const roleCode of [RoleCode.owner, RoleCode.admin, RoleCode.operator]) {
      const membershipRepository = {
        findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(roleCode)),
      } as unknown as OrganizationMembershipRepository;

      const service = new AuthorizationService(membershipRepository);

      await expect(
        service.requireOrganizationPermission(
          {} as DbClient,
          requestContext,
          "organization-id",
          "supply.write",
        ),
      ).resolves.toBeDefined();
    }
  });

  it("allows an owner to invite members", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(RoleCode.owner)),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    const membership = await service.requireOrganizationPermission(
      {} as DbClient,
      requestContext,
      "organization-id",
      "organization.invite_member",
    );

    expect(membership.role.code).toBe(RoleCode.owner);
  });

  it("denies a viewer from inviting members", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(RoleCode.viewer)),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "organization.invite_member",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies access when the user is not a member", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(null),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "organization.entitlements.read",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows a viewer to read catalog data", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(RoleCode.viewer)),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    const membership = await service.requireOrganizationPermission(
      {} as DbClient,
      requestContext,
      "organization-id",
      "catalog.read",
    );

    expect(membership.role.code).toBe(RoleCode.viewer);
  });

  it("denies a viewer from mutating inventory", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(RoleCode.viewer)),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "inventory.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows a viewer to read demand and forecasting data", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(RoleCode.viewer)),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "demand.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "forecasting.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "supply.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "decisioning.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "ai.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "outcomes.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "workflow.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "billing.read",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "integrations.read",
      ),
    ).resolves.toBeDefined();

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "support.read",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies a viewer from mutating demand and forecasting", async () => {
    const membershipRepository = {
      findByUserAndOrganization: vi.fn().mockResolvedValue(buildMembership(RoleCode.viewer)),
    } as unknown as OrganizationMembershipRepository;

    const service = new AuthorizationService(membershipRepository);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "demand.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "forecasting.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "supply.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "decisioning.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "ai.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "outcomes.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "workflow.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "billing.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "integrations.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      service.requireOrganizationPermission(
        {} as DbClient,
        requestContext,
        "organization-id",
        "support.write",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
