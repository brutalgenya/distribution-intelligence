import { RoleCode, type PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildAuthHeaders, createTestApp } from "../helpers/test-app.js";
import {
  createMembership,
  createOrganizationWithMembership,
  createTestPrismaClient,
  createUser,
  resetDatabase,
} from "../helpers/test-database.js";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

describe.runIf(hasTestDatabase)("Catalog and inventory integration", () => {
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

  it("creates catalog SKUs and locations within an organization", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Catalog Org",
      slug: "catalog-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const createSkuResponse = await app.inject({
      method: "POST",
      url: "/catalog/skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuCode: "SKU-001",
        name: "Widget",
        description: "Primary widget",
        baseUom: "each",
        packSize: 12,
        metadata: {
          family: "widgets",
        },
      },
    });

    expect(createSkuResponse.statusCode).toBe(201);
    const sku = createSkuResponse.json();

    const duplicateSkuResponse = await app.inject({
      method: "POST",
      url: "/catalog/skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuCode: "SKU-001",
        name: "Widget 2",
        baseUom: "each",
        packSize: 1,
      },
    });

    expect(duplicateSkuResponse.statusCode).toBe(409);

    const createLocationResponse = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "MAIN",
        name: "Main Warehouse",
        type: "warehouse",
      },
    });

    expect(createLocationResponse.statusCode).toBe(201);
    const location = createLocationResponse.json();

    expect(sku.organizationId).toBe(organization.id);
    expect(location.organizationId).toBe(organization.id);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { occurredAt: "asc" },
    });

    expect(auditEvents.map((event) => event.eventType)).toContain("catalog.sku.created");
    expect(auditEvents.map((event) => event.eventType)).toContain("inventory.location.created");
    expect(outboxEvents.map((event) => event.eventType)).toContain("catalog.sku.created.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("inventory.location.created.v1");
  });

  it("receives inventory and recomputes the canonical position", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Inventory Org",
      slug: "inventory-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const skuResponse = await app.inject({
      method: "POST",
      url: "/catalog/skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuCode: "INV-001",
        name: "Inventory Widget",
        baseUom: "each",
        packSize: 1,
      },
    });
    const sku = skuResponse.json();

    const locationResponse = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "MAIN",
        name: "Main Warehouse",
        type: "warehouse",
      },
    });
    const location = locationResponse.json();

    const receiptResponse = await app.inject({
      method: "POST",
      url: "/inventory/receipts",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
        quantity: 20,
        referenceType: "purchase_order",
        referenceId: "PO-100",
      },
    });

    expect(receiptResponse.statusCode).toBe(201);
    const receiptBody = receiptResponse.json();

    expect(receiptBody.position.onHandQty).toBe(20);
    expect(receiptBody.position.reservedQty).toBe(0);
    expect(receiptBody.position.inTransitQty).toBe(0);
    expect(receiptBody.position.availableToPromiseQty).toBe(20);

    const positionsResponse = await app.inject({
      method: "GET",
      url: "/inventory/positions",
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(positionsResponse.statusCode).toBe(200);
    expect(positionsResponse.json()).toHaveLength(1);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(outboxEvents.map((event) => event.eventType)).toContain("inventory.received.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("inventory.position.recomputed.v1");
  });

  it("reserves and releases inventory with idempotent-safe release", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Reservation Org",
      slug: "reservation-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const skuResponse = await app.inject({
      method: "POST",
      url: "/catalog/skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuCode: "RSV-001",
        name: "Reservable Widget",
        baseUom: "each",
        packSize: 1,
      },
    });
    const sku = skuResponse.json();

    const locationResponse = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "MAIN",
        name: "Main Warehouse",
        type: "warehouse",
      },
    });
    const location = locationResponse.json();

    await app.inject({
      method: "POST",
      url: "/inventory/receipts",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
        quantity: 15,
        referenceType: "purchase_order",
        referenceId: "PO-200",
      },
    });

    const overReserveResponse = await app.inject({
      method: "POST",
      url: "/inventory/reservations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
        quantity: 20,
        referenceType: "sales_order",
        referenceId: "SO-200",
      },
    });

    expect(overReserveResponse.statusCode).toBe(409);

    const reserveResponse = await app.inject({
      method: "POST",
      url: "/inventory/reservations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
        quantity: 5,
        referenceType: "sales_order",
        referenceId: "SO-201",
      },
    });

    expect(reserveResponse.statusCode).toBe(201);
    const reservationBody = reserveResponse.json();
    expect(reservationBody.position.availableToPromiseQty).toBe(10);
    expect(reservationBody.position.reservedQty).toBe(5);

    const releaseResponse = await app.inject({
      method: "POST",
      url: `/inventory/reservations/${reservationBody.reservation.id}/release`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(releaseResponse.statusCode).toBe(200);
    const releasedBody = releaseResponse.json();
    expect(releasedBody.reservation.status).toBe("released");
    expect(releasedBody.position.availableToPromiseQty).toBe(15);
    expect(releasedBody.position.reservedQty).toBe(0);

    const secondReleaseResponse = await app.inject({
      method: "POST",
      url: `/inventory/reservations/${reservationBody.reservation.id}/release`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(secondReleaseResponse.statusCode).toBe(200);
    expect(secondReleaseResponse.json().reservation.status).toBe("released");

    const releaseMovements = await prisma.inventoryMovement.findMany({
      where: {
        organizationId: organization.id,
        referenceType: "inventory_reservation",
        referenceId: reservationBody.reservation.id,
      },
    });

    expect(releaseMovements).toHaveLength(2);
  });

  it("requests and completes transfers with deterministic position recomputation", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Transfer Org",
      slug: "transfer-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const skuResponse = await app.inject({
      method: "POST",
      url: "/catalog/skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuCode: "TRN-001",
        name: "Transfer Widget",
        baseUom: "each",
        packSize: 1,
      },
    });
    const sku = skuResponse.json();

    const sourceLocationResponse = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "SRC",
        name: "Source Warehouse",
        type: "warehouse",
      },
    });
    const sourceLocation = sourceLocationResponse.json();

    const destinationLocationResponse = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "DST",
        name: "Destination Warehouse",
        type: "warehouse",
      },
    });
    const destinationLocation = destinationLocationResponse.json();

    await app.inject({
      method: "POST",
      url: "/inventory/receipts",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: sourceLocation.id,
        quantity: 12,
        referenceType: "purchase_order",
        referenceId: "PO-300",
      },
    });

    const requestTransferResponse = await app.inject({
      method: "POST",
      url: "/inventory/transfers",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        sourceLocationId: sourceLocation.id,
        destinationLocationId: destinationLocation.id,
        quantity: 7,
      },
    });

    expect(requestTransferResponse.statusCode).toBe(201);
    const transferBody = requestTransferResponse.json();

    expect(transferBody.sourcePosition.onHandQty).toBe(5);
    expect(transferBody.destinationPosition.inTransitQty).toBe(7);
    expect(transferBody.destinationPosition.availableToPromiseQty).toBe(7);

    const completeTransferResponse = await app.inject({
      method: "POST",
      url: `/inventory/transfers/${transferBody.transfer.id}/complete`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(completeTransferResponse.statusCode).toBe(200);
    const completedBody = completeTransferResponse.json();

    expect(completedBody.transfer.status).toBe("completed");
    expect(completedBody.sourcePosition.onHandQty).toBe(5);
    expect(completedBody.destinationPosition.onHandQty).toBe(7);
    expect(completedBody.destinationPosition.inTransitQty).toBe(0);
    expect(completedBody.destinationPosition.availableToPromiseQty).toBe(7);

    const secondCompleteResponse = await app.inject({
      method: "POST",
      url: `/inventory/transfers/${transferBody.transfer.id}/complete`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(secondCompleteResponse.statusCode).toBe(200);
    expect(secondCompleteResponse.json().transfer.status).toBe("completed");

    const transferMovements = await prisma.inventoryMovement.findMany({
      where: {
        organizationId: organization.id,
        referenceType: "inventory_transfer",
        referenceId: transferBody.transfer.id,
      },
    });

    expect(transferMovements).toHaveLength(2);
  });

  it("enforces viewer read-only access and tenant isolation", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const viewer = await createUser(prisma, {
      email: "viewer@example.com",
      displayName: "Viewer",
    });
    const outsider = await createUser(prisma, {
      email: "outsider@example.com",
      displayName: "Outsider",
    });

    const organization = await createOrganizationWithMembership(prisma, {
      name: "Scoped Org",
      slug: "scoped-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });

    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Other Org",
      slug: "other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const skuResponse = await app.inject({
      method: "POST",
      url: "/catalog/skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuCode: "TEN-001",
        name: "Tenant Widget",
        baseUom: "each",
        packSize: 1,
      },
    });
    const sku = skuResponse.json();

    const locationResponse = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "MAIN",
        name: "Main Warehouse",
        type: "warehouse",
      },
    });
    const location = locationResponse.json();

    const viewerMutationResponse = await app.inject({
      method: "POST",
      url: "/inventory/receipts",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
        quantity: 10,
        referenceType: "purchase_order",
        referenceId: "PO-400",
      },
    });

    expect(viewerMutationResponse.statusCode).toBe(403);

    const outsiderReadResponse = await app.inject({
      method: "GET",
      url: `/catalog/skus/${sku.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });

    expect(outsiderReadResponse.statusCode).toBe(404);
  });
});
