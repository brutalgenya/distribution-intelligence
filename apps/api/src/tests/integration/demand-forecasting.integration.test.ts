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

const createSku = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { skuCode: string; name: string },
) => {
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
  return response.json();
};

const createLocation = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { code: string; name: string },
) => {
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
  return response.json();
};

describe.runIf(hasTestDatabase)("Demand and forecasting integration", () => {
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

  it("imports historical sales with idempotent duplicate skipping", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Demand Org",
      slug: "demand-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    await createSku(app, owner.id, organization.id, {
      skuCode: "DMD-001",
      name: "Demand Widget",
    });
    await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });

    const csvContent = [
      "skuCode,locationCode,quantity,soldAt,sourceReference",
      "DMD-001,MAIN,4,2026-03-10T00:00:00.000Z,SALE-100",
      "DMD-001,MAIN,6,2026-03-11T00:00:00.000Z,SALE-101",
    ].join("\n");

    const firstImportResponse = await app.inject({
      method: "POST",
      url: "/demand/sales/import",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        csvContent,
      },
    });

    expect(firstImportResponse.statusCode).toBe(201);
    const firstImportBody = firstImportResponse.json();
    expect(firstImportBody.run.status).toBe("completed");
    expect(firstImportBody.run.acceptedRows).toBe(2);
    expect(firstImportBody.run.duplicateRows).toBe(0);
    expect(firstImportBody.run.rejectedRows).toBe(0);

    const secondImportResponse = await app.inject({
      method: "POST",
      url: "/demand/sales/import",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        csvContent,
      },
    });

    expect(secondImportResponse.statusCode).toBe(201);
    const secondImportBody = secondImportResponse.json();
    expect(secondImportBody.run.status).toBe("completed");
    expect(secondImportBody.run.acceptedRows).toBe(0);
    expect(secondImportBody.run.duplicateRows).toBe(2);
    expect(secondImportBody.run.rejectedRows).toBe(0);

    const historicalSales = await prisma.historicalSale.findMany({
      where: { organizationId: organization.id },
    });
    const demandSignals = await prisma.demandSignal.findMany({
      where: { organizationId: organization.id, signalType: "historical_sale" },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(historicalSales).toHaveLength(2);
    expect(demandSignals).toHaveLength(2);
    expect(auditEvents.map((event) => event.eventType)).toContain("demand.sales.imported");
    expect(outboxEvents.map((event) => event.eventType)).toContain("demand.sales.imported.v1");
  });

  it("reports row-level validation failures while still accepting valid sales rows", async () => {
    const owner = await createUser(prisma, {
      email: "owner@example.com",
      displayName: "Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Validation Org",
      slug: "validation-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    await createSku(app, owner.id, organization.id, {
      skuCode: "VAL-001",
      name: "Validation Widget",
    });
    await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });

    const response = await app.inject({
      method: "POST",
      url: "/demand/sales/import",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        csvContent: [
          "skuCode,locationCode,quantity,soldAt,sourceReference",
          "VAL-001,MAIN,5,2026-03-12T00:00:00.000Z,SALE-200",
          "UNKNOWN,MAIN,3,2026-03-13T00:00:00.000Z,SALE-201",
        ].join("\n"),
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.run.status).toBe("failed");
    expect(body.run.acceptedRows).toBe(1);
    expect(body.run.rejectedRows).toBe(1);
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Unknown skuCode: UNKNOWN.",
        }),
      ]),
    );

    const historicalSales = await prisma.historicalSale.findMany({
      where: { organizationId: organization.id },
    });

    expect(historicalSales).toHaveLength(1);
  });

  it("creates and idempotently cancels customer orders while enforcing viewer write denial", async () => {
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
      name: "Order Org",
      slug: "order-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Other Order Org",
      slug: "other-order-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, {
      skuCode: "ORD-001",
      name: "Order Widget",
    });
    const location = await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });

    const viewerCreateResponse = await app.inject({
      method: "POST",
      url: "/demand/orders",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        orderNumber: "SO-VIEWER",
        orderedAt: "2026-03-21T00:00:00.000Z",
        lines: [
          {
            skuId: sku.id,
            locationId: location.id,
            quantity: 3,
          },
        ],
      },
    });

    expect(viewerCreateResponse.statusCode).toBe(403);

    const createOrderResponse = await app.inject({
      method: "POST",
      url: "/demand/orders",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        orderNumber: "SO-300",
        customerReference: "Customer-300",
        orderedAt: "2026-03-21T00:00:00.000Z",
        lines: [
          {
            skuId: sku.id,
            locationId: location.id,
            quantity: 5,
          },
        ],
      },
    });

    expect(createOrderResponse.statusCode).toBe(201);
    const order = createOrderResponse.json();
    expect(order.status).toBe("open");

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/demand/orders/${order.id}/cancel`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json().status).toBe("cancelled");

    const secondCancelResponse = await app.inject({
      method: "POST",
      url: `/demand/orders/${order.id}/cancel`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(secondCancelResponse.statusCode).toBe(200);
    expect(secondCancelResponse.json().status).toBe("cancelled");

    const outsiderGetResponse = await app.inject({
      method: "GET",
      url: `/demand/orders/${order.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });

    expect(outsiderGetResponse.statusCode).toBe(404);

    const demandSignals = await prisma.demandSignal.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(demandSignals.map((signal) => signal.quantity)).toEqual([5, -5]);
    expect(outboxEvents.map((event) => event.eventType)).toContain("demand.order.created.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("demand.order.cancelled.v1");
  });

  it("creates pending forecast jobs and processes them through the async path", async () => {
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
      name: "Forecast Org",
      slug: "forecast-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Other Forecast Org",
      slug: "other-forecast-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, {
      skuCode: "FRC-001",
      name: "Forecast Widget",
    });
    const location = await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });

    const importRows = ["skuCode,locationCode,quantity,soldAt,sourceReference"];
    for (let day = 0; day < 14; day += 1) {
      const dayNumber = String(day + 1).padStart(2, "0");
      importRows.push(`FRC-001,MAIN,2,2026-03-${dayNumber}T00:00:00.000Z,SALE-${dayNumber}`);
    }

    const importResponse = await app.inject({
      method: "POST",
      url: "/demand/sales/import",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        csvContent: importRows.join("\n"),
      },
    });

    expect(importResponse.statusCode).toBe(201);

    const viewerJobResponse = await app.inject({
      method: "POST",
      url: "/forecasting/jobs",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        scopeType: "sku_location",
        skuId: sku.id,
        locationId: location.id,
        horizonDays: 3,
      },
    });

    expect(viewerJobResponse.statusCode).toBe(403);

    const createJobResponse = await app.inject({
      method: "POST",
      url: "/forecasting/jobs",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        scopeType: "sku_location",
        skuId: sku.id,
        locationId: location.id,
        horizonDays: 3,
      },
    });

    expect(createJobResponse.statusCode).toBe(201);
    const createdJob = createJobResponse.json();
    expect(createdJob.status).toBe("pending");

    const resultsBeforeProcessResponse = await app.inject({
      method: "GET",
      url: `/forecasting/jobs/${createdJob.id}/results`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(resultsBeforeProcessResponse.statusCode).toBe(200);
    expect(resultsBeforeProcessResponse.json()).toEqual([]);

    const outsiderGetJobResponse = await app.inject({
      method: "GET",
      url: `/forecasting/jobs/${createdJob.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });

    expect(outsiderGetJobResponse.statusCode).toBe(404);

    const processResponse = await app.inject({
      method: "POST",
      url: `/forecasting/jobs/${createdJob.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(processResponse.statusCode).toBe(200);
    const processBody = processResponse.json();
    expect(processBody.processedNow).toBe(true);
    expect(processBody.job.status).toBe("completed");
    expect(processBody.results).toHaveLength(3);
    expect(processBody.results.map((result: { forecastQty: number }) => result.forecastQty)).toEqual([2, 2, 2]);

    const secondProcessResponse = await app.inject({
      method: "POST",
      url: `/forecasting/jobs/${createdJob.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(secondProcessResponse.statusCode).toBe(200);
    expect(secondProcessResponse.json().processedNow).toBe(false);

    const persistedResults = await prisma.forecastResult.findMany({
      where: { forecastJobId: createdJob.id },
      orderBy: { forecastDate: "asc" },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(persistedResults).toHaveLength(3);
    expect(auditEvents.map((event) => event.eventType)).toContain("forecast.job.created");
    expect(auditEvents.map((event) => event.eventType)).toContain("forecast.job.started");
    expect(auditEvents.map((event) => event.eventType)).toContain("forecast.generated");
    expect(outboxEvents.map((event) => event.eventType)).toContain("forecast.job.created.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("forecast.job.started.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("forecast.generated.v1");
  });
});
