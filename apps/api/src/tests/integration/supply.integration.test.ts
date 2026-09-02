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

interface SkuResponse {
  id: string;
  organizationId: string;
}

interface LocationResponse {
  id: string;
  organizationId: string;
}

interface SupplierResponse {
  id: string;
  organizationId: string;
  code: string;
}

interface SupplierSkuResponse {
  id: string;
  supplierId: string;
  skuId: string;
  isPrimary: boolean;
}

interface PurchaseOrderLineResponse {
  id: string;
  skuId: string;
  quantityOrdered: number;
  quantityReceived: number;
  expectedLocationId: string | null;
}

interface PurchaseOrderResponse {
  id: string;
  organizationId: string;
  supplierId: string;
  poNumber: string;
  status: string;
  orderedAt: string | null;
  receivedAt: string | null;
  wasEverDelayed: boolean;
  lines: PurchaseOrderLineResponse[];
}

interface SupplierPerformanceResponse {
  totalPurchaseOrders: number;
  delayedPurchaseOrders: number;
  receivedPurchaseOrders: number;
  averageLeadTimeDays: number | null;
  lastReceiptAt: string | null;
}

interface SupplierLeadTimeStatResponse {
  skuId: string;
  sampleCount: number;
  averageLeadTimeDays: number;
  lastObservedAt: string;
}

const createSku = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { skuCode: string; name: string },
): Promise<SkuResponse> => {
  const response = await app.inject({
    method: "POST",
    url: "/catalog/skus",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      skuCode: input.skuCode,
      name: input.name,
      baseUom: "each",
      packSize: 1,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json() as SkuResponse;
};

const createLocation = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { code: string; name: string },
): Promise<LocationResponse> => {
  const response = await app.inject({
    method: "POST",
    url: "/inventory/locations",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      code: input.code,
      name: input.name,
      type: "warehouse",
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json() as LocationResponse;
};

const createSupplier = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { code: string; name: string },
): Promise<SupplierResponse> => {
  const response = await app.inject({
    method: "POST",
    url: "/supply/suppliers",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      code: input.code,
      name: input.name,
      status: "active",
      contactEmail: "buyer@example.com",
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json() as SupplierResponse;
};

describe.runIf(hasTestDatabase)("Supply integration", () => {
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

  it("creates suppliers and supplier SKU mappings with tenant-safe boundaries", async () => {
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
      name: "Supply Org",
      slug: "supply-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Other Supply Org",
      slug: "other-supply-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, {
      skuCode: "SUP-SKU-001",
      name: "Supply Widget",
    });
    const outsiderSku = await createSku(app, outsider.id, outsiderOrganization.id, {
      skuCode: "OTHER-SKU-001",
      name: "Other Widget",
    });

    const viewerCreateSupplierResponse = await app.inject({
      method: "POST",
      url: "/supply/suppliers",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        code: "VIEWER-SUP",
        name: "Viewer Supplier",
        status: "active",
      },
    });

    expect(viewerCreateSupplierResponse.statusCode).toBe(403);

    const supplier = await createSupplier(app, owner.id, organization.id, {
      code: "SUP-001",
      name: "Acme Supply",
    });

    const duplicateSupplierResponse = await app.inject({
      method: "POST",
      url: "/supply/suppliers",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        code: "SUP-001",
        name: "Duplicate Supply",
        status: "active",
      },
    });

    expect(duplicateSupplierResponse.statusCode).toBe(409);

    const createMappingResponse = await app.inject({
      method: "POST",
      url: "/supply/supplier-skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        supplierId: supplier.id,
        skuId: sku.id,
        supplierSkuCode: "ACME-SKU-001",
        isPrimary: true,
        minOrderQty: 5,
        casePackQty: 10,
        unitCost: 12.5,
        leadTimeDays: 7,
      },
    });

    expect(createMappingResponse.statusCode).toBe(201);
    const mapping = createMappingResponse.json() as SupplierSkuResponse;
    expect(mapping.supplierId).toBe(supplier.id);
    expect(mapping.skuId).toBe(sku.id);
    expect(mapping.isPrimary).toBe(true);

    const crossTenantMappingResponse = await app.inject({
      method: "POST",
      url: "/supply/supplier-skus",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        supplierId: supplier.id,
        skuId: outsiderSku.id,
        isPrimary: false,
        minOrderQty: 1,
      },
    });

    expect(crossTenantMappingResponse.statusCode).toBe(404);

    const bySupplierResponse = await app.inject({
      method: "GET",
      url: `/supply/supplier-skus/by-supplier/${supplier.id}`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(bySupplierResponse.statusCode).toBe(200);
    expect(bySupplierResponse.json()).toHaveLength(1);

    const outsiderGetSupplierResponse = await app.inject({
      method: "GET",
      url: `/supply/suppliers/${supplier.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });

    expect(outsiderGetSupplierResponse.statusCode).toBe(404);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { occurredAt: "asc" },
    });

    expect(auditEvents.map((event) => event.eventType)).toContain("supply.supplier.created");
    expect(auditEvents.map((event) => event.eventType)).toContain("supply.supplier_sku.mapped");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.supplier.created.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.supplier_sku.mapped.v1");
  });

  it("runs the purchase order lifecycle, updates inventory, and records supply analytics idempotently", async () => {
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
      name: "Purchase Order Org",
      slug: "purchase-order-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Other Purchase Order Org",
      slug: "other-purchase-order-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, {
      skuCode: "PO-SKU-001",
      name: "Purchase Order Widget",
    });
    const location = await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });
    const supplier = await createSupplier(app, owner.id, organization.id, {
      code: "SUP-PO-001",
      name: "Inbound Supply",
    });

    const viewerCreatePurchaseOrderResponse = await app.inject({
      method: "POST",
      url: "/supply/purchase-orders",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        supplierId: supplier.id,
        poNumber: "PO-VIEWER",
        lines: [
          {
            skuId: sku.id,
            quantityOrdered: 5,
            expectedLocationId: location.id,
          },
        ],
      },
    });

    expect(viewerCreatePurchaseOrderResponse.statusCode).toBe(403);

    const createPurchaseOrderResponse = await app.inject({
      method: "POST",
      url: "/supply/purchase-orders",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        supplierId: supplier.id,
        poNumber: "PO-100",
        currency: "usd",
        expectedDeliveryAt: "2026-04-03T00:00:00.000Z",
        notes: "Initial inbound order",
        lines: [
          {
            skuId: sku.id,
            quantityOrdered: 10,
            unitCost: 22.75,
            expectedLocationId: location.id,
          },
        ],
      },
    });

    expect(createPurchaseOrderResponse.statusCode).toBe(201);
    const purchaseOrder = createPurchaseOrderResponse.json() as PurchaseOrderResponse;
    expect(purchaseOrder.status).toBe("draft");
    expect(purchaseOrder.lines).toHaveLength(1);
    const purchaseOrderLine = purchaseOrder.lines[0];
    expect(purchaseOrderLine).toBeDefined();

    const duplicatePurchaseOrderResponse = await app.inject({
      method: "POST",
      url: "/supply/purchase-orders",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        supplierId: supplier.id,
        poNumber: "PO-100",
        lines: [
          {
            skuId: sku.id,
            quantityOrdered: 1,
            expectedLocationId: location.id,
          },
        ],
      },
    });

    expect(duplicatePurchaseOrderResponse.statusCode).toBe(409);

    const outsiderGetPurchaseOrderResponse = await app.inject({
      method: "GET",
      url: `/supply/purchase-orders/${purchaseOrder.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });

    expect(outsiderGetPurchaseOrderResponse.statusCode).toBe(404);

    const submitResponse = await app.inject({
      method: "POST",
      url: `/supply/purchase-orders/${purchaseOrder.id}/submit`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(submitResponse.statusCode).toBe(200);
    const submittedPurchaseOrder = submitResponse.json() as PurchaseOrderResponse;
    expect(submittedPurchaseOrder.status).toBe("submitted");
    expect(submittedPurchaseOrder.orderedAt).not.toBeNull();

    const delayResponse = await app.inject({
      method: "POST",
      url: `/supply/purchase-orders/${purchaseOrder.id}/delay`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        expectedDeliveryAt: "2026-04-05T00:00:00.000Z",
        notes: "Carrier slipped by two days",
      },
    });

    expect(delayResponse.statusCode).toBe(200);
    const delayedPurchaseOrder = delayResponse.json() as PurchaseOrderResponse;
    expect(delayedPurchaseOrder.status).toBe("delayed");
    expect(delayedPurchaseOrder.wasEverDelayed).toBe(true);

    const partialReceiptResponse = await app.inject({
      method: "POST",
      url: `/supply/purchase-orders/${purchaseOrder.id}/receive`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        receivedAt: "2026-03-31T00:00:00.000Z",
        lines: [
          {
            lineId: purchaseOrderLine!.id,
            quantityReceived: 4,
          },
        ],
      },
    });

    expect(partialReceiptResponse.statusCode).toBe(200);
    const partiallyReceivedPurchaseOrder = partialReceiptResponse.json() as PurchaseOrderResponse;
    expect(partiallyReceivedPurchaseOrder.status).toBe("partially_received");
    const partiallyReceivedLine = partiallyReceivedPurchaseOrder.lines[0];
    expect(partiallyReceivedLine).toBeDefined();
    expect(partiallyReceivedLine!.quantityReceived).toBe(4);

    const partialPosition = await prisma.inventoryPosition.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(partialPosition.onHandQty).toBe(4);
    expect(partialPosition.availableToPromiseQty).toBe(4);

    const repeatPartialReceiptResponse = await app.inject({
      method: "POST",
      url: `/supply/purchase-orders/${purchaseOrder.id}/receive`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        receivedAt: "2026-03-31T00:00:00.000Z",
        lines: [
          {
            lineId: purchaseOrderLine!.id,
            quantityReceived: 4,
          },
        ],
      },
    });

    expect(repeatPartialReceiptResponse.statusCode).toBe(200);
    expect((repeatPartialReceiptResponse.json() as PurchaseOrderResponse).status).toBe("partially_received");

    const movementsAfterRetry = await prisma.inventoryMovement.findMany({
      where: {
        organizationId: organization.id,
        referenceType: "purchase_order_line",
        referenceId: purchaseOrderLine!.id,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(movementsAfterRetry).toHaveLength(1);
    expect(movementsAfterRetry[0]?.quantity).toBe(4);

    const finalReceiptResponse = await app.inject({
      method: "POST",
      url: `/supply/purchase-orders/${purchaseOrder.id}/receive`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        receivedAt: "2026-04-02T00:00:00.000Z",
        lines: [
          {
            lineId: purchaseOrderLine!.id,
            quantityReceived: 10,
          },
        ],
      },
    });

    expect(finalReceiptResponse.statusCode).toBe(200);
    const receivedPurchaseOrder = finalReceiptResponse.json() as PurchaseOrderResponse;
    expect(receivedPurchaseOrder.status).toBe("received");
    expect(receivedPurchaseOrder.receivedAt).toBe("2026-04-02T00:00:00.000Z");
    const receivedLine = receivedPurchaseOrder.lines[0];
    expect(receivedLine).toBeDefined();
    expect(receivedLine!.quantityReceived).toBe(10);

    const finalPosition = await prisma.inventoryPosition.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(finalPosition.onHandQty).toBe(10);
    expect(finalPosition.availableToPromiseQty).toBe(10);

    const finalMovements = await prisma.inventoryMovement.findMany({
      where: {
        organizationId: organization.id,
        referenceType: "purchase_order_line",
        referenceId: purchaseOrderLine!.id,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(finalMovements).toHaveLength(2);
    expect(finalMovements.map((movement) => movement.quantity)).toEqual([4, 6]);

    const performanceResponse = await app.inject({
      method: "GET",
      url: `/supply/suppliers/${supplier.id}/performance`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(performanceResponse.statusCode).toBe(200);
    const performance = performanceResponse.json() as SupplierPerformanceResponse;
    expect(performance.totalPurchaseOrders).toBe(1);
    expect(performance.delayedPurchaseOrders).toBe(1);
    expect(performance.receivedPurchaseOrders).toBe(1);
    expect(performance.lastReceiptAt).toBe("2026-04-02T00:00:00.000Z");
    expect(performance.averageLeadTimeDays).not.toBeNull();

    const leadTimeStatsResponse = await app.inject({
      method: "GET",
      url: `/supply/suppliers/${supplier.id}/lead-time-stats`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(leadTimeStatsResponse.statusCode).toBe(200);
    const leadTimeStats = leadTimeStatsResponse.json() as SupplierLeadTimeStatResponse[];
    expect(leadTimeStats).toHaveLength(1);
    expect(leadTimeStats[0]?.skuId).toBe(sku.id);
    expect(leadTimeStats[0]?.sampleCount).toBe(1);
    expect(leadTimeStats[0]?.lastObservedAt).toBe("2026-04-02T00:00:00.000Z");
    expect(leadTimeStats[0]?.averageLeadTimeDays).toBeGreaterThanOrEqual(0);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(auditEvents.map((event) => event.eventType)).toContain("supply.purchase_order.created");
    expect(auditEvents.map((event) => event.eventType)).toContain("supply.purchase_order.submitted");
    expect(auditEvents.map((event) => event.eventType)).toContain("supply.purchase_order.delayed");
    expect(auditEvents.map((event) => event.eventType)).toContain("supply.purchase_order.received");
    expect(auditEvents.map((event) => event.eventType)).toContain("supply.performance.updated");
    expect(auditEvents.map((event) => event.eventType)).toContain("supply.lead_time.updated");

    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.purchase_order.created.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.purchase_order.submitted.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.purchase_order.delayed.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.purchase_order.received.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.performance.updated.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("supply.lead_time.updated.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("inventory.received.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("inventory.position.recomputed.v1");
  });
});
