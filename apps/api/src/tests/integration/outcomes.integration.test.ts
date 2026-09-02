import {
  AutomationTier,
  ForecastJobStatus,
  ForecastModelType,
  ForecastScopeType,
  RoleCode,
  type PrismaClient,
} from "@prisma/client";
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
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfUtcDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));

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

const createSupplier = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { code: string; name: string },
) => {
  const response = await app.inject({
    method: "POST",
    url: "/supply/suppliers",
    headers: buildAuthHeaders(userId, organizationId),
    payload: input,
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const createSupplierSku = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: {
    supplierId: string;
    skuId: string;
    minOrderQty: number;
    casePackQty: number;
    leadTimeDays: number;
    unitCost: number;
  },
) => {
  const response = await app.inject({
    method: "POST",
    url: "/supply/supplier-skus",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      supplierId: input.supplierId,
      skuId: input.skuId,
      isPrimary: true,
      minOrderQty: input.minOrderQty,
      casePackQty: input.casePackQty,
      leadTimeDays: input.leadTimeDays,
      unitCost: input.unitCost,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const receiveInventory = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: { skuId: string; locationId: string; quantity: number; referenceId: string },
) => {
  const response = await app.inject({
    method: "POST",
    url: "/inventory/receipts",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      skuId: input.skuId,
      locationId: input.locationId,
      quantity: input.quantity,
      referenceType: "purchase_order",
      referenceId: input.referenceId,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const createCustomerOrder = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  input: {
    orderNumber: string;
    orderedAt: string;
    skuId: string;
    locationId: string;
    quantity: number;
  },
) => {
  const response = await app.inject({
    method: "POST",
    url: "/demand/orders",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      orderNumber: input.orderNumber,
      orderedAt: input.orderedAt,
      lines: [
        {
          skuId: input.skuId,
          locationId: input.locationId,
          quantity: input.quantity,
        },
      ],
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

const createActivePolicy = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  payload:
    | {
        policyType: "replenishment";
        name: string;
        version: number;
        rulesJson: {
          automationTier: AutomationTier;
          forecastHorizonDays: number;
          targetDaysOfCover: number;
          leadTimeBufferDays: number;
          defaultLeadTimeDays: number;
          useSafetyStock: boolean;
          shortageBufferQty: number;
          demandSpikeMultiplier: number;
        };
      }
    | {
        policyType: "exception";
        name: string;
        version: number;
        rulesJson: {
          automationTier: AutomationTier;
          forecastHorizonDays: number;
          leadTimeDriftThresholdDays: number;
          demandSpikeMultiplier: number;
          stockoutRiskCoverDays: number;
        };
      },
) => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/decisioning/policies",
    headers: buildAuthHeaders(userId, organizationId),
    payload,
  });

  expect(createResponse.statusCode).toBe(201);
  const createdPolicy = createResponse.json();

  const activateResponse = await app.inject({
    method: "POST",
    url: `/decisioning/policies/${createdPolicy.id}/activate`,
    headers: buildAuthHeaders(userId, organizationId),
  });

  expect(activateResponse.statusCode).toBe(200);
  return activateResponse.json();
};

const createCompletedForecast = async (
  prisma: PrismaClient,
  input: {
    organizationId: string;
    requestedByUserId: string;
    skuId: string;
    locationId: string;
    forecastDates: Date[];
    quantities: number[];
    completedAt: Date;
  },
) => {
  const forecastJob = await prisma.forecastJob.create({
    data: {
      organizationId: input.organizationId,
      status: ForecastJobStatus.completed,
      requestedByUserId: input.requestedByUserId,
      scopeType: ForecastScopeType.sku_location,
      scopeReference: {
        skuId: input.skuId,
        locationId: input.locationId,
      },
      horizonDays: input.quantities.length,
      modelType: ForecastModelType.baseline_recent_average,
      inputSnapshot: {
        anchorDate: input.completedAt.toISOString(),
      },
      startedAt: new Date(input.completedAt.getTime() - 60_000),
      completedAt: input.completedAt,
    },
  });

  await prisma.forecastResult.createMany({
    data: input.quantities.map((forecastQty, index) => ({
      organizationId: input.organizationId,
      forecastJobId: forecastJob.id,
      skuId: input.skuId,
      locationId: input.locationId,
      forecastDate: input.forecastDates[index]!,
      forecastQty,
      confidenceLow: Math.max(0, Math.floor(forecastQty * 0.8)),
      confidenceHigh: Math.ceil(forecastQty * 1.2),
      modelType: ForecastModelType.baseline_recent_average,
    })),
  });

  return forecastJob;
};

const createHistoricalSale = async (
  prisma: PrismaClient,
  input: {
    organizationId: string;
    createdByUserId: string;
    skuId: string;
    locationId: string;
    quantity: number;
    soldAt: Date;
    referenceSuffix: string;
  },
) => {
  const run = await prisma.salesImportRun.create({
    data: {
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      status: "completed",
      totalRows: 1,
      acceptedRows: 1,
      rejectedRows: 0,
      startedAt: input.soldAt,
      completedAt: input.soldAt,
    },
  });

  return prisma.historicalSale.create({
    data: {
      organizationId: input.organizationId,
      salesImportRunId: run.id,
      skuId: input.skuId,
      locationId: input.locationId,
      quantity: input.quantity,
      soldAt: input.soldAt,
      sourceType: "historical_sale",
      sourceReference: `sale-${input.referenceSuffix}`,
      rowFingerprint: `${input.organizationId}:${input.skuId}:${input.locationId}:${input.referenceSuffix}`,
    },
  });
};

const setupExecutedDecision = async (
  prisma: PrismaClient,
  app: FastifyInstance,
  input: {
    userId: string;
    organizationId: string;
    skuCode: string;
    locationCode: string;
    supplierCode: string;
    forecastDates: Date[];
    forecastQuantities: number[];
    completedAt: Date;
  },
) => {
  const sku = await createSku(app, input.userId, input.organizationId, {
    skuCode: input.skuCode,
    name: `${input.skuCode} SKU`,
  });
  const location = await createLocation(app, input.userId, input.organizationId, {
    code: input.locationCode,
    name: `${input.locationCode} Warehouse`,
  });
  const supplier = await createSupplier(app, input.userId, input.organizationId, {
    code: input.supplierCode,
    name: `${input.supplierCode} Supplier`,
  });

  await createSupplierSku(app, input.userId, input.organizationId, {
    supplierId: supplier.id,
    skuId: sku.id,
    minOrderQty: 12,
    casePackQty: 6,
    leadTimeDays: 2,
    unitCost: 5,
  });

  await createActivePolicy(app, input.userId, input.organizationId, {
    policyType: "replenishment",
    name: `${input.skuCode} Replenishment`,
    version: 1,
    rulesJson: {
      automationTier: AutomationTier.auto_execute,
      forecastHorizonDays: 2,
      targetDaysOfCover: 3,
      leadTimeBufferDays: 0,
      defaultLeadTimeDays: 7,
      useSafetyStock: true,
      shortageBufferQty: 0,
      demandSpikeMultiplier: 2,
    },
  });
  await createActivePolicy(app, input.userId, input.organizationId, {
    policyType: "exception",
    name: `${input.skuCode} Exceptions`,
    version: 1,
    rulesJson: {
      automationTier: AutomationTier.observe,
      forecastHorizonDays: 2,
      leadTimeDriftThresholdDays: 3,
      demandSpikeMultiplier: 2,
      stockoutRiskCoverDays: 3,
    },
  });

  await receiveInventory(app, input.userId, input.organizationId, {
    skuId: sku.id,
    locationId: location.id,
    quantity: 5,
    referenceId: `PO-${input.skuCode}`,
  });

  await createCompletedForecast(prisma, {
    organizationId: input.organizationId,
    requestedByUserId: input.userId,
    skuId: sku.id,
    locationId: location.id,
    forecastDates: input.forecastDates,
    quantities: input.forecastQuantities,
    completedAt: input.completedAt,
  });

  const generateResponse = await app.inject({
    method: "POST",
    url: "/decisioning/replenishment/generate",
    headers: buildAuthHeaders(input.userId, input.organizationId),
    payload: {
      skuId: sku.id,
      locationId: location.id,
    },
  });

  expect(generateResponse.statusCode).toBe(200);
  const decision = generateResponse.json().decision;

  const requestExecutionResponse = await app.inject({
    method: "POST",
    url: `/workflow/decisions/${decision.id}/request-execution`,
    headers: buildAuthHeaders(input.userId, input.organizationId),
  });

  expect(requestExecutionResponse.statusCode).toBe(201);
  const executionTask = requestExecutionResponse.json().executionTask;

  const processResponse = await app.inject({
    method: "POST",
    url: `/workflow/executions/${executionTask.id}/process`,
    headers: buildAuthHeaders(input.userId, input.organizationId),
  });

  expect(processResponse.statusCode).toBe(200);
  expect(processResponse.json().task.status).toBe("succeeded");

  return { sku, location, decision };
};

describe.runIf(hasTestDatabase)("Outcomes integration", () => {
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

  it("computes stockout incidents, fill rate, and forecast error while enforcing viewer denial and tenant isolation", async () => {
    const owner = await createUser(prisma, {
      email: "outcomes-owner@example.com",
      displayName: "Outcomes Owner",
    });
    const viewer = await createUser(prisma, {
      email: "outcomes-viewer@example.com",
      displayName: "Outcomes Viewer",
    });
    const outsider = await createUser(prisma, {
      email: "outcomes-outsider@example.com",
      displayName: "Outcomes Outsider",
    });

    const organization = await createOrganizationWithMembership(prisma, {
      name: "Outcomes Org",
      slug: "outcomes-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Outcomes Other Org",
      slug: "outcomes-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const baseDay = startOfUtcDay(new Date());
    const windowStart = baseDay;
    const windowEnd = new Date(baseDay.getTime() + 2 * DAY_IN_MS);
    const previousDay = new Date(baseDay.getTime() - DAY_IN_MS);
    const dayOneNoon = new Date(baseDay.getTime() + DAY_IN_MS + 12 * 60 * 60 * 1000);

    const { sku, location } = await setupExecutedDecision(prisma, app, {
      userId: owner.id,
      organizationId: organization.id,
      skuCode: "OUT-001",
      locationCode: "OUT-MAIN",
      supplierCode: "OUT-SUP",
      forecastDates: [
        new Date(baseDay.getTime() + DAY_IN_MS),
        new Date(baseDay.getTime() + 2 * DAY_IN_MS - 60 * 1000),
      ],
      forecastQuantities: [5, 5],
      completedAt: new Date(baseDay.getTime() + 60 * 60 * 1000),
    });

    const stockoutSku = await createSku(app, owner.id, organization.id, {
      skuCode: "OUT-STOCKOUT",
      name: "Stockout SKU",
    });

    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "BASELINE-001",
      orderedAt: previousDay.toISOString(),
      skuId: sku.id,
      locationId: location.id,
      quantity: 10,
    });
    await createHistoricalSale(prisma, {
      organizationId: organization.id,
      createdByUserId: owner.id,
      skuId: sku.id,
      locationId: location.id,
      quantity: 5,
      soldAt: previousDay,
      referenceSuffix: "baseline",
    });

    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "WINDOW-001",
      orderedAt: dayOneNoon.toISOString(),
      skuId: sku.id,
      locationId: location.id,
      quantity: 10,
    });
    await createHistoricalSale(prisma, {
      organizationId: organization.id,
      createdByUserId: owner.id,
      skuId: sku.id,
      locationId: location.id,
      quantity: 8,
      soldAt: dayOneNoon,
      referenceSuffix: "window",
    });

    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "STOCKOUT-001",
      orderedAt: dayOneNoon.toISOString(),
      skuId: stockoutSku.id,
      locationId: location.id,
      quantity: 4,
    });

    const viewerResponse = await app.inject({
      method: "POST",
      url: "/outcomes/fill-rate/compute",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
      },
    });
    expect(viewerResponse.statusCode).toBe(403);

    const stockoutResponse = await app.inject({
      method: "POST",
      url: "/outcomes/stockouts/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
        skuId: stockoutSku.id,
        locationId: location.id,
      },
    });
    expect(stockoutResponse.statusCode).toBe(200);
    expect(stockoutResponse.json().computedCount).toBe(1);

    const fillRateResponse = await app.inject({
      method: "POST",
      url: "/outcomes/fill-rate/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
        skuId: sku.id,
        locationId: location.id,
      },
    });
    expect(fillRateResponse.statusCode).toBe(200);
    expect(fillRateResponse.json().measurements[0].fillRate).toBe(0.8);

    const forecastErrorResponse = await app.inject({
      method: "POST",
      url: "/outcomes/forecast-error/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
        skuId: sku.id,
        locationId: location.id,
      },
    });
    expect(forecastErrorResponse.statusCode).toBe(200);
    expect(forecastErrorResponse.json().measurements[0].absoluteError).toBe(2);

    const outsiderReadResponse = await app.inject({
      method: "GET",
      url: `/outcomes/stockouts/${stockoutResponse.json().incidents[0].id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });
    expect(outsiderReadResponse.statusCode).toBe(404);
  });

  it("computes decision outcomes and policy effectiveness consistently, with audit and outbox rows", async () => {
    const owner = await createUser(prisma, {
      email: "outcomes-summary-owner@example.com",
      displayName: "Outcomes Summary Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Outcomes Summary Org",
      slug: "outcomes-summary-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const baseDay = startOfUtcDay(new Date());
    const windowStart = baseDay;
    const windowEnd = new Date(baseDay.getTime() + 2 * DAY_IN_MS);
    const previousDay = new Date(baseDay.getTime() - DAY_IN_MS);
    const dayOneNoon = new Date(baseDay.getTime() + DAY_IN_MS + 12 * 60 * 60 * 1000);

    const { sku, location, decision } = await setupExecutedDecision(prisma, app, {
      userId: owner.id,
      organizationId: organization.id,
      skuCode: "OUT-DEC-001",
      locationCode: "OUT-DEC-MAIN",
      supplierCode: "OUT-DEC-SUP",
      forecastDates: [
        new Date(baseDay.getTime() + DAY_IN_MS),
        new Date(baseDay.getTime() + 2 * DAY_IN_MS - 60 * 1000),
      ],
      forecastQuantities: [5, 5],
      completedAt: new Date(baseDay.getTime() + 60 * 60 * 1000),
    });

    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "BASELINE-DEC-001",
      orderedAt: previousDay.toISOString(),
      skuId: sku.id,
      locationId: location.id,
      quantity: 10,
    });
    await createHistoricalSale(prisma, {
      organizationId: organization.id,
      createdByUserId: owner.id,
      skuId: sku.id,
      locationId: location.id,
      quantity: 5,
      soldAt: previousDay,
      referenceSuffix: "baseline-decision",
    });

    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "WINDOW-DEC-001",
      orderedAt: dayOneNoon.toISOString(),
      skuId: sku.id,
      locationId: location.id,
      quantity: 10,
    });
    await createHistoricalSale(prisma, {
      organizationId: organization.id,
      createdByUserId: owner.id,
      skuId: sku.id,
      locationId: location.id,
      quantity: 8,
      soldAt: dayOneNoon,
      referenceSuffix: "window-decision",
    });

    await app.inject({
      method: "POST",
      url: "/outcomes/fill-rate/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
        skuId: sku.id,
        locationId: location.id,
      },
    });
    await app.inject({
      method: "POST",
      url: "/outcomes/forecast-error/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
        skuId: sku.id,
        locationId: location.id,
      },
    });

    const firstOutcomeResponse = await app.inject({
      method: "POST",
      url: "/outcomes/decisions/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        decisionId: decision.id,
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
      },
    });
    expect(firstOutcomeResponse.statusCode).toBe(200);
    const firstOutcome = firstOutcomeResponse.json().outcomes[0];
    expect(firstOutcome.outcomeStatus).toBe("computed");

    const secondOutcomeResponse = await app.inject({
      method: "POST",
      url: "/outcomes/decisions/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        decisionId: decision.id,
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
      },
    });
    expect(secondOutcomeResponse.statusCode).toBe(200);
    expect(secondOutcomeResponse.json().outcomes[0].id).toBe(firstOutcome.id);

    const summaryResponse = await app.inject({
      method: "POST",
      url: "/outcomes/policies/compute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: windowStart.toISOString(),
        measurementWindowEnd: windowEnd.toISOString(),
      },
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().computedCount).toBeGreaterThan(0);

    const decisionOutcomeReadResponse = await app.inject({
      method: "GET",
      url: `/outcomes/decisions/by-decision/${decision.id}`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(decisionOutcomeReadResponse.statusCode).toBe(200);
    expect(decisionOutcomeReadResponse.json()[0].id).toBe(firstOutcome.id);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(auditEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "outcome.fill_rate.measured",
        "outcome.forecast_error.computed",
        "outcome.decision.computed",
        "outcome.policy_effectiveness.updated",
      ]),
    );
    expect(outboxEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "outcome.fill_rate.measured.v1",
        "outcome.forecast_error.computed.v1",
        "outcome.decision.computed.v1",
        "outcome.policy_effectiveness.updated.v1",
      ]),
    );
  });
});
