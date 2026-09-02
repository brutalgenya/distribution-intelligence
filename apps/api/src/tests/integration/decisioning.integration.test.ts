import {
  AutomationTier,
  ForecastJobStatus,
  ForecastModelType,
  ForecastScopeType,
  PolicyType,
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
    payload: {
      code: input.code,
      name: input.name,
    },
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
    casePackQty?: number;
    leadTimeDays?: number;
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
      ...(input.casePackQty ? { casePackQty: input.casePackQty } : {}),
      ...(input.leadTimeDays ? { leadTimeDays: input.leadTimeDays } : {}),
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
        policyType: "allocation";
        name: string;
        version: number;
        rulesJson: {
          automationTier: AutomationTier;
          shortageThresholdQty: number;
          prioritizationMode: "oldest_order_first";
          maxAffectedOrders: number;
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
        demandSignalCreatedAtCutoff: input.completedAt.toISOString(),
        lookbackDays: 14,
        horizonDays: input.quantities.length,
        modelType: ForecastModelType.baseline_recent_average,
        scopeType: ForecastScopeType.sku_location,
        scopeReference: {
          skuId: input.skuId,
          locationId: input.locationId,
        },
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
      forecastDate: new Date(input.completedAt.getTime() + (index + 1) * 24 * 60 * 60 * 1000),
      forecastQty,
      confidenceLow: Math.max(0, Math.floor(forecastQty * 0.8)),
      confidenceHigh: Math.ceil(forecastQty * 1.2),
      modelType: ForecastModelType.baseline_recent_average,
    })),
  });

  return forecastJob;
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

describe.runIf(hasTestDatabase)("Decisioning integration", () => {
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

  it("creates and activates policies with audit and outbox records", async () => {
    const owner = await createUser(prisma, {
      email: "policy-owner@example.com",
      displayName: "Policy Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Policy Org",
      slug: "policy-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/decisioning/policies",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        policyType: PolicyType.replenishment,
        name: "Replenishment v1",
        version: 1,
        rulesJson: {
          automationTier: AutomationTier.recommend,
          forecastHorizonDays: 5,
          targetDaysOfCover: 3,
          leadTimeBufferDays: 0,
          defaultLeadTimeDays: 7,
          useSafetyStock: true,
          shortageBufferQty: 0,
          demandSpikeMultiplier: 2,
        },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const createdPolicy = createResponse.json();

    const activateResponse = await app.inject({
      method: "POST",
      url: `/decisioning/policies/${createdPolicy.id}/activate`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(activateResponse.statusCode).toBe(200);
    expect(activateResponse.json().status).toBe("active");

    const activePolicyResponse = await app.inject({
      method: "GET",
      url: `/decisioning/policies/active/${PolicyType.replenishment}`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(activePolicyResponse.statusCode).toBe(200);
    expect(activePolicyResponse.json().id).toBe(createdPolicy.id);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { occurredAt: "asc" },
    });

    expect(auditEvents.map((event) => event.eventType)).toContain("decision.policy.created");
    expect(auditEvents.map((event) => event.eventType)).toContain("decision.policy.activated");
    expect(outboxEvents.map((event) => event.eventType)).toContain("decision.policy.created.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("decision.policy.activated.v1");
  });

  it("generates replenishment proposals, persists rationale, and supersedes stale proposals when inputs change", async () => {
    const owner = await createUser(prisma, {
      email: "replenishment-owner@example.com",
      displayName: "Replenishment Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Decision Org",
      slug: "decision-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, {
      skuCode: "DEC-001",
      name: "Decision SKU",
    });
    const location = await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });
    const supplier = await createSupplier(app, owner.id, organization.id, {
      code: "SUP-DEC-001",
      name: "Decision Supplier",
    });

    await createSupplierSku(app, owner.id, organization.id, {
      supplierId: supplier.id,
      skuId: sku.id,
      minOrderQty: 12,
      casePackQty: 6,
      leadTimeDays: 2,
    });

    await createActivePolicy(app, owner.id, organization.id, {
      policyType: PolicyType.replenishment,
      name: "Replenishment v1",
      version: 1,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        forecastHorizonDays: 5,
        targetDaysOfCover: 3,
        leadTimeBufferDays: 0,
        defaultLeadTimeDays: 7,
        useSafetyStock: true,
        shortageBufferQty: 0,
        demandSpikeMultiplier: 2,
      },
    });
    await createActivePolicy(app, owner.id, organization.id, {
      policyType: PolicyType.exception,
      name: "Exceptions v1",
      version: 1,
      rulesJson: {
        automationTier: AutomationTier.observe,
        forecastHorizonDays: 5,
        leadTimeDriftThresholdDays: 3,
        demandSpikeMultiplier: 2,
        stockoutRiskCoverDays: 3,
      },
    });

    await receiveInventory(app, owner.id, organization.id, {
      skuId: sku.id,
      locationId: location.id,
      quantity: 7,
      referenceId: "PO-DEC-001",
    });

    await createCompletedForecast(prisma, {
      organizationId: organization.id,
      requestedByUserId: owner.id,
      skuId: sku.id,
      locationId: location.id,
      quantities: [4, 4, 4, 4, 4],
      completedAt: new Date("2026-03-28T01:00:00.000Z"),
    });

    const firstGenerateResponse = await app.inject({
      method: "POST",
      url: "/decisioning/replenishment/generate",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(firstGenerateResponse.statusCode).toBe(200);
    const firstBody = firstGenerateResponse.json();
    expect(firstBody.generated).toBe(true);
    expect(firstBody.deduplicated).toBe(false);
    expect(firstBody.decision.decisionType).toBe("replenishment");
    expect(firstBody.decision.proposedPayload.recommendedOrderQty).toBe(18);

    const persistedDecision = await prisma.decision.findUniqueOrThrow({
      where: { id: firstBody.decision.id },
      include: {
        reasons: true,
        scores: true,
        artifacts: true,
      },
    });

    expect(persistedDecision.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        "forecast_exceeds_available_supply",
        "open_purchase_order_insufficient",
      ]),
    );
    expect(persistedDecision.artifacts.some((artifact) => artifact.artifactType === "forecast_snapshot")).toBe(true);

    const secondGenerateResponse = await app.inject({
      method: "POST",
      url: "/decisioning/replenishment/generate",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(secondGenerateResponse.statusCode).toBe(200);
    const secondBody = secondGenerateResponse.json();
    expect(secondBody.generated).toBe(true);
    expect(secondBody.deduplicated).toBe(true);
    expect(secondBody.decision.id).toBe(firstBody.decision.id);

    await createCompletedForecast(prisma, {
      organizationId: organization.id,
      requestedByUserId: owner.id,
      skuId: sku.id,
      locationId: location.id,
      quantities: [5, 5, 5, 5, 5],
      completedAt: new Date("2026-03-28T02:00:00.000Z"),
    });

    const thirdGenerateResponse = await app.inject({
      method: "POST",
      url: "/decisioning/replenishment/generate",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(thirdGenerateResponse.statusCode).toBe(200);
    const thirdBody = thirdGenerateResponse.json();
    expect(thirdBody.generated).toBe(true);
    expect(thirdBody.deduplicated).toBe(false);
    expect(thirdBody.decision.id).not.toBe(firstBody.decision.id);
    expect(thirdBody.supersededDecisionIds).toEqual([firstBody.decision.id]);

    const originalDecision = await prisma.decision.findUniqueOrThrow({
      where: { id: firstBody.decision.id },
    });
    expect(originalDecision.status).toBe("superseded");

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(auditEvents.map((event) => event.eventType)).toContain("decision.replenishment.proposed");
    expect(auditEvents.map((event) => event.eventType)).toContain("decision.proposal.superseded");
    expect(outboxEvents.map((event) => event.eventType)).toContain("decision.replenishment.proposed.v1");
    expect(outboxEvents.map((event) => event.eventType)).toContain("decision.proposal.superseded.v1");
  });

  it("raises exception decisions when forecast data or supplier mappings are missing", async () => {
    const owner = await createUser(prisma, {
      email: "exception-owner@example.com",
      displayName: "Exception Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Exception Org",
      slug: "exception-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const location = await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });

    const skuMissingForecast = await createSku(app, owner.id, organization.id, {
      skuCode: "EXC-001",
      name: "Missing Forecast SKU",
    });
    const skuMissingSupplier = await createSku(app, owner.id, organization.id, {
      skuCode: "EXC-002",
      name: "Missing Supplier SKU",
    });
    const supplier = await createSupplier(app, owner.id, organization.id, {
      code: "SUP-EXC-001",
      name: "Exception Supplier",
    });

    await createSupplierSku(app, owner.id, organization.id, {
      supplierId: supplier.id,
      skuId: skuMissingForecast.id,
      minOrderQty: 1,
      leadTimeDays: 3,
    });

    await createActivePolicy(app, owner.id, organization.id, {
      policyType: PolicyType.replenishment,
      name: "Replenishment v1",
      version: 1,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        forecastHorizonDays: 3,
        targetDaysOfCover: 3,
        leadTimeBufferDays: 0,
        defaultLeadTimeDays: 7,
        useSafetyStock: true,
        shortageBufferQty: 0,
        demandSpikeMultiplier: 2,
      },
    });
    await createActivePolicy(app, owner.id, organization.id, {
      policyType: PolicyType.exception,
      name: "Exceptions v1",
      version: 1,
      rulesJson: {
        automationTier: AutomationTier.observe,
        forecastHorizonDays: 3,
        leadTimeDriftThresholdDays: 3,
        demandSpikeMultiplier: 2,
        stockoutRiskCoverDays: 3,
      },
    });

    await receiveInventory(app, owner.id, organization.id, {
      skuId: skuMissingForecast.id,
      locationId: location.id,
      quantity: 2,
      referenceId: "PO-EXC-001",
    });

    await receiveInventory(app, owner.id, organization.id, {
      skuId: skuMissingSupplier.id,
      locationId: location.id,
      quantity: 2,
      referenceId: "PO-EXC-002",
    });

    await createCompletedForecast(prisma, {
      organizationId: organization.id,
      requestedByUserId: owner.id,
      skuId: skuMissingSupplier.id,
      locationId: location.id,
      quantities: [4, 4, 4],
      completedAt: new Date("2026-03-28T03:00:00.000Z"),
    });

    const missingForecastResponse = await app.inject({
      method: "POST",
      url: "/decisioning/replenishment/generate",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: skuMissingForecast.id,
        locationId: location.id,
      },
    });

    expect(missingForecastResponse.statusCode).toBe(200);
    const missingForecastBody = missingForecastResponse.json();
    expect(missingForecastBody.generated).toBe(true);
    expect(missingForecastBody.decision.decisionType).toBe("exception");
    expect(missingForecastBody.decision.reasons.map((reason: { code: string }) => reason.code)).toContain(
      "missing_forecast",
    );

    const missingSupplierResponse = await app.inject({
      method: "POST",
      url: "/decisioning/replenishment/generate",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: skuMissingSupplier.id,
        locationId: location.id,
      },
    });

    expect(missingSupplierResponse.statusCode).toBe(200);
    const missingSupplierBody = missingSupplierResponse.json();
    expect(missingSupplierBody.generated).toBe(true);
    expect(missingSupplierBody.decision.decisionType).toBe("exception");
    expect(missingSupplierBody.decision.reasons.map((reason: { code: string }) => reason.code)).toContain(
      "no_primary_supplier",
    );
  });

  it("generates allocation recommendations while enforcing viewer read-only access and tenant isolation", async () => {
    const owner = await createUser(prisma, {
      email: "allocation-owner@example.com",
      displayName: "Allocation Owner",
    });
    const viewer = await createUser(prisma, {
      email: "allocation-viewer@example.com",
      displayName: "Allocation Viewer",
    });
    const outsider = await createUser(prisma, {
      email: "allocation-outsider@example.com",
      displayName: "Allocation Outsider",
    });

    const organization = await createOrganizationWithMembership(prisma, {
      name: "Allocation Org",
      slug: "allocation-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Other Allocation Org",
      slug: "other-allocation-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, {
      skuCode: "ALC-001",
      name: "Allocation SKU",
    });
    const location = await createLocation(app, owner.id, organization.id, {
      code: "MAIN",
      name: "Main Warehouse",
    });

    await createActivePolicy(app, owner.id, organization.id, {
      policyType: PolicyType.allocation,
      name: "Allocation v1",
      version: 1,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        shortageThresholdQty: 1,
        prioritizationMode: "oldest_order_first",
        maxAffectedOrders: 10,
      },
    });

    await receiveInventory(app, owner.id, organization.id, {
      skuId: sku.id,
      locationId: location.id,
      quantity: 5,
      referenceId: "PO-ALC-001",
    });

    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "SO-001",
      orderedAt: "2026-03-20T00:00:00.000Z",
      skuId: sku.id,
      locationId: location.id,
      quantity: 3,
    });
    await createCustomerOrder(app, owner.id, organization.id, {
      orderNumber: "SO-002",
      orderedAt: "2026-03-21T00:00:00.000Z",
      skuId: sku.id,
      locationId: location.id,
      quantity: 4,
    });

    const viewerGenerateResponse = await app.inject({
      method: "POST",
      url: "/decisioning/allocation/generate",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(viewerGenerateResponse.statusCode).toBe(403);

    const generateResponse = await app.inject({
      method: "POST",
      url: "/decisioning/allocation/generate",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        locationId: location.id,
      },
    });

    expect(generateResponse.statusCode).toBe(200);
    const generateBody = generateResponse.json();
    expect(generateBody.generated).toBe(true);
    expect(generateBody.decision.decisionType).toBe("allocation");
    expect(generateBody.decision.proposedPayload.shortageQty).toBe(2);
    expect(generateBody.decision.proposedPayload.affectedOrderRefs).toEqual(["SO-002"]);

    const outsiderReadResponse = await app.inject({
      method: "GET",
      url: `/decisioning/decisions/${generateBody.decision.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });

    expect(outsiderReadResponse.statusCode).toBe(404);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });
    expect(outboxEvents.map((event) => event.eventType)).toContain("decision.allocation.proposed.v1");
  });
});
