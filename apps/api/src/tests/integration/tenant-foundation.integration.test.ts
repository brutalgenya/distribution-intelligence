import { RoleCode, type PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, buildAuthHeaders } from "../helpers/test-app.js";
import {
  createOrganizationWithMembership,
  createTestPrismaClient,
  createUser,
  resetDatabase,
} from "../helpers/test-database.js";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

describe.runIf(hasTestDatabase)("Tenant foundation integration", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    app = await createTestApp(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates an organization, owner membership, and default entitlements", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });

    const response = await app.inject({
      method: "POST",
      url: "/organizations",
      headers: buildAuthHeaders(owner.id),
      payload: {
        name: "Acme Distribution",
        slug: "acme-distribution",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();

    expect(body.organization.slug).toBe("acme-distribution");
    expect(body.ownerMembership.user.id).toBe(owner.id);
    expect(body.ownerMembership.role).toBe(RoleCode.owner);

    const membershipCount = await prisma.organizationMembership.count({
      where: { organizationId: body.organization.id },
    });
    const entitlementCount = await prisma.entitlement.count({
      where: { organizationId: body.organization.id },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: body.organization.id },
      select: { eventType: true },
      orderBy: { eventType: "asc" },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: body.organization.id },
      select: { eventType: true },
      orderBy: { eventType: "asc" },
    });

    expect(membershipCount).toBe(1);
    expect(entitlementCount).toBe(3);
    expect(auditEvents.map(({ eventType }) => eventType)).toEqual([
      "billing.subscription.created",
      "billing.usage.recorded",
      "organization.created",
    ]);
    expect(outboxEvents.map(({ eventType }) => eventType)).toEqual([
      "billing.subscription.created.v1",
      "billing.usage.recorded.v1",
      "organization.created",
    ]);
  });

  it("supports invitation creation, acceptance, and membership listing", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const invitee = await createUser(prisma, {
      email: "viewer@example.com",
      displayName: "Viewer",
    });

    const createOrganizationResponse = await app.inject({
      method: "POST",
      url: "/organizations",
      headers: buildAuthHeaders(owner.id),
      payload: {
        name: "Northwind Wholesale",
        slug: "northwind-wholesale",
      },
    });

    expect(createOrganizationResponse.statusCode).toBe(201);
    const createOrganizationBody = createOrganizationResponse.json();
    const organizationId = createOrganizationBody.organization.id as string;

    const inviteResponse = await app.inject({
      method: "POST",
      url: `/organizations/${organizationId}/invitations`,
      headers: buildAuthHeaders(owner.id, organizationId),
      payload: {
        email: invitee.email,
        role: RoleCode.viewer,
      },
    });

    expect(inviteResponse.statusCode).toBe(201);
    const inviteBody = inviteResponse.json();

    const acceptResponse = await app.inject({
      method: "POST",
      url: "/invitations/accept",
      headers: buildAuthHeaders(invitee.id),
      payload: {
        token: inviteBody.token,
      },
    });

    expect(acceptResponse.statusCode).toBe(200);
    const acceptBody = acceptResponse.json();

    expect(acceptBody.membership.user.id).toBe(invitee.id);
    expect(acceptBody.membership.role).toBe(RoleCode.viewer);

    const membershipsResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organizationId}/memberships`,
      headers: buildAuthHeaders(owner.id, organizationId),
    });

    expect(membershipsResponse.statusCode).toBe(200);
    const membershipsBody = membershipsResponse.json();
    expect(membershipsBody).toHaveLength(2);

    const entitlementsResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organizationId}/entitlements`,
      headers: buildAuthHeaders(invitee.id, organizationId),
    });

    expect(entitlementsResponse.statusCode).toBe(200);
    expect(entitlementsResponse.json()).toHaveLength(3);
  });

  it("prevents cross-tenant membership reads by design", async () => {
    const viewer = await createUser(prisma, {
      email: "viewer@example.com",
      displayName: "Viewer",
    });
    const outsider = await createUser(prisma, {
      email: "outsider@example.com",
      displayName: "Outsider",
    });

    const organization = await createOrganizationWithMembership(prisma, {
      name: "Scoped Tenant",
      slug: "scoped-tenant",
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });

    const response = await app.inject({
      method: "GET",
      url: `/organizations/${organization.id}/memberships`,
      headers: buildAuthHeaders(outsider.id, organization.id),
    });

    expect(response.statusCode).toBe(403);
  });
});
