import { RoleCode, type PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildAuthHeaders, createTestApp } from "../helpers/test-app.js";
import {
  createOrganizationWithMembership,
  createTestPrismaClient,
  createUser,
  resetDatabase,
} from "../helpers/test-database.js";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

const createIntegrationConnection = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
) => {
  const response = await app.inject({
    method: "POST",
    url: "/integrations/connections",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      integrationType: "manual_bridge",
      name: "Manual Bridge",
      configJson: {
        sourceLabel: "test-suite",
      },
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const createSyncRun = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  payload: Record<string, unknown>,
) => {
  const response = await app.inject({
    method: "POST",
    url: "/integrations/syncs",
    headers: buildAuthHeaders(userId, organizationId),
    payload,
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const processSyncRun = async (app: FastifyInstance, userId: string, organizationId: string, syncRunId: string) => {
  const response = await app.inject({
    method: "POST",
    url: `/integrations/syncs/${syncRunId}/process`,
    headers: buildAuthHeaders(userId, organizationId),
  });

  expect(response.statusCode).toBe(200);
  return response.json();
};

const createSku = async (app: FastifyInstance, userId: string, organizationId: string, skuCode = "SKU-001") => {
  const response = await app.inject({
    method: "POST",
    url: "/catalog/skus",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      skuCode,
      name: skuCode,
      baseUom: "each",
      packSize: 1,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const createLocation = async (app: FastifyInstance, userId: string, organizationId: string, code = "WH-1") => {
  const response = await app.inject({
    method: "POST",
    url: "/inventory/locations",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      code,
      name: code,
      type: "warehouse",
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

describe.runIf(hasTestDatabase)("Integrations", () => {
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

  it("creates an integration connection and runs a replay-safe catalog import", async () => {
    const owner = await createUser(prisma, {
      email: "integration-owner@example.com",
      displayName: "Integration Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Integration Org",
      slug: "integration-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const connection = await createIntegrationConnection(app, owner.id, organization.id);

    const firstSync = await createSyncRun(app, owner.id, organization.id, {
      connectionId: connection.id,
      syncType: "catalog_import",
      direction: "inbound",
      inputPayload: {
        records: [
          {
            kind: "catalog_sku",
            sourceReference: "erp-sku-1",
            payload: {
              skuCode: "INT-SKU-001",
              name: "Imported SKU",
              baseUom: "each",
              packSize: 6,
              status: "active",
            },
          },
          {
            kind: "location",
            sourceReference: "erp-location-1",
            payload: {
              code: "INT-WH-1",
              name: "Imported Warehouse",
              type: "warehouse",
              status: "active",
            },
          },
        ],
      },
    });

    const firstProcessedSync = await processSyncRun(app, owner.id, organization.id, firstSync.id);
    expect(firstProcessedSync.status).toBe("completed");

    const secondSync = await createSyncRun(app, owner.id, organization.id, {
      connectionId: connection.id,
      syncType: "catalog_import",
      direction: "inbound",
      inputPayload: {
        records: [
          {
            kind: "catalog_sku",
            sourceReference: "erp-sku-1",
            payload: {
              skuCode: "INT-SKU-001",
              name: "Imported SKU",
              baseUom: "each",
              packSize: 6,
              status: "active",
            },
          },
          {
            kind: "location",
            sourceReference: "erp-location-1",
            payload: {
              code: "INT-WH-1",
              name: "Imported Warehouse",
              type: "warehouse",
              status: "active",
            },
          },
        ],
      },
    });

    const secondProcessedSync = await processSyncRun(app, owner.id, organization.id, secondSync.id);
    expect(secondProcessedSync.status).toBe("completed");

    const skus = await prisma.sku.findMany({
      where: { organizationId: organization.id, skuCode: "INT-SKU-001" },
    });
    const locations = await prisma.location.findMany({
      where: { organizationId: organization.id, code: "INT-WH-1" },
    });

    expect(skus).toHaveLength(1);
    expect(locations).toHaveLength(1);
  });

  it("runs a demand import, persists failed records, and enforces tenant isolation", async () => {
    const owner = await createUser(prisma, {
      email: "demand-owner@example.com",
      displayName: "Demand Owner",
    });
    const outsider = await createUser(prisma, {
      email: "demand-outsider@example.com",
      displayName: "Demand Outsider",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Demand Org",
      slug: "demand-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Demand Other Org",
      slug: "demand-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    await createSku(app, owner.id, organization.id, "SKU-DEM-1");
    await createLocation(app, owner.id, organization.id, "LOC-DEM-1");
    const connection = await createIntegrationConnection(app, owner.id, organization.id);

    const sync = await createSyncRun(app, owner.id, organization.id, {
      connectionId: connection.id,
      syncType: "demand_import",
      direction: "inbound",
      inputPayload: {
        records: [
          {
            kind: "customer_order",
            sourceReference: "erp-order-1",
            payload: {
              orderNumber: "ORD-INT-1",
              orderedAt: "2026-03-28T10:00:00.000Z",
              lines: [
                {
                  skuCode: "SKU-DEM-1",
                  locationCode: "LOC-DEM-1",
                  quantity: 4,
                },
              ],
            },
          },
          {
            kind: "historical_sale",
            sourceReference: "erp-sale-1",
            payload: {
              skuCode: "UNKNOWN-SKU",
              locationCode: "LOC-DEM-1",
              quantity: 2,
              soldAt: "2026-03-27T10:00:00.000Z",
              sourceType: "erp_sales_export",
            },
          },
        ],
      },
    });

    const processedSync = await processSyncRun(app, owner.id, organization.id, sync.id);
    expect(processedSync.status).toBe("partial");

    const orders = await prisma.customerOrder.findMany({
      where: { organizationId: organization.id, orderNumber: "ORD-INT-1" },
    });
    const failedRecords = await prisma.integrationFailedRecord.findMany({
      where: { organizationId: organization.id },
    });

    expect(orders).toHaveLength(1);
    expect(failedRecords).toHaveLength(1);

    const failedRecordRead = await app.inject({
      method: "GET",
      url: `/integrations/failed-records/${failedRecords[0]?.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });
    expect(failedRecordRead.statusCode).toBe(404);
  });

  it("imports inventory snapshots without duplicating inventory on replay and writes audit/outbox rows", async () => {
    const owner = await createUser(prisma, {
      email: "inventory-owner@example.com",
      displayName: "Inventory Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Inventory Org",
      slug: "inventory-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, "SKU-INV-1");
    const location = await createLocation(app, owner.id, organization.id, "LOC-INV-1");
    const connection = await createIntegrationConnection(app, owner.id, organization.id);

    const createAndProcessSnapshot = async () => {
      const sync = await createSyncRun(app, owner.id, organization.id, {
        connectionId: connection.id,
        syncType: "inventory_import",
        direction: "inbound",
        inputPayload: {
          records: [
            {
              kind: "inventory_snapshot",
              sourceReference: "wms-snapshot-1",
              payload: {
                skuCode: sku.skuCode,
                locationCode: location.code,
                onHandQty: 25,
              },
            },
          ],
        },
      });

      return processSyncRun(app, owner.id, organization.id, sync.id);
    };

    const firstRun = await createAndProcessSnapshot();
    const secondRun = await createAndProcessSnapshot();

    expect(firstRun.status).toBe("completed");
    expect(secondRun.status).toBe("completed");

    const position = await prisma.inventoryPosition.findUnique({
      where: {
        organizationId_skuId_locationId: {
          organizationId: organization.id,
          skuId: sku.id,
          locationId: location.id,
        },
      },
    });
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        organizationId: organization.id,
        referenceType: "integration_inventory_snapshot",
        referenceId: "wms-snapshot-1",
      },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: {
          in: ["inventory.adjusted", "integration.sync.completed"],
        },
      },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: {
          in: ["inventory.adjusted.v1", "integration.sync.completed.v1"],
        },
      },
    });

    expect(position?.onHandQty).toBe(25);
    expect(movements).toHaveLength(1);
    expect(auditEvents.length).toBeGreaterThanOrEqual(2);
    expect(outboxEvents.length).toBeGreaterThanOrEqual(2);
  });
});
