import {
  AutomationTier,
  ForecastJobStatus,
  ForecastModelType,
  ForecastScopeType,
  Prisma,
  RoleCode,
  WorkerRunStatus,
  WorkerType,
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

const createActiveAllocationPolicy = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
) => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/decisioning/policies",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      policyType: "allocation",
      name: "Allocation Support Policy",
      version: 1,
      rulesJson: {
        automationTier: AutomationTier.auto_execute,
        shortageThresholdQty: 1,
        prioritizationMode: "oldest_order_first",
        maxAffectedOrders: 10,
      },
    },
  });

  expect(createResponse.statusCode).toBe(201);
  const policy = createResponse.json();

  const activateResponse = await app.inject({
    method: "POST",
    url: `/decisioning/policies/${policy.id}/activate`,
    headers: buildAuthHeaders(userId, organizationId),
  });

  expect(activateResponse.statusCode).toBe(200);
};

const setupFailedExecutionTask = async (
  app: FastifyInstance,
  prisma: PrismaClient,
  input: { userId: string; organizationId: string },
) => {
  const sku = await createSku(app, input.userId, input.organizationId, {
    skuCode: "SUP-ALLOC-001",
    name: "Support Allocation SKU",
  });
  const location = await createLocation(app, input.userId, input.organizationId, {
    code: "SUP-ALLOC-MAIN",
    name: "Support Allocation Warehouse",
  });

  await createActiveAllocationPolicy(app, input.userId, input.organizationId);
  await receiveInventory(app, input.userId, input.organizationId, {
    skuId: sku.id,
    locationId: location.id,
    quantity: 5,
    referenceId: "PO-SUPPORT-001",
  });
  await createCustomerOrder(app, input.userId, input.organizationId, {
    orderNumber: "SO-SUPPORT-001",
    orderedAt: "2026-03-20T00:00:00.000Z",
    skuId: sku.id,
    locationId: location.id,
    quantity: 3,
  });
  await createCustomerOrder(app, input.userId, input.organizationId, {
    orderNumber: "SO-SUPPORT-002",
    orderedAt: "2026-03-21T00:00:00.000Z",
    skuId: sku.id,
    locationId: location.id,
    quantity: 4,
  });

  const generateResponse = await app.inject({
    method: "POST",
    url: "/decisioning/allocation/generate",
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
    url: "/workflow/executions",
    headers: buildAuthHeaders(input.userId, input.organizationId),
    payload: {
      decisionId: decision.id,
    },
  });

  expect(requestExecutionResponse.statusCode).toBe(201);
  const executionTask = requestExecutionResponse.json().executionTask;

  await prisma.executionTask.update({
    where: { id: executionTask.id },
    data: {
      payload: {
        decisionId: decision.id,
        summary: "Support retryable notification",
        testFailureMode: "retryable",
        testFailureUntilAttemptNumber: 1,
      },
    },
  });

  const firstProcessResponse = await app.inject({
    method: "POST",
    url: `/workflow/executions/${executionTask.id}/process`,
    headers: buildAuthHeaders(input.userId, input.organizationId),
  });

  expect(firstProcessResponse.statusCode).toBe(200);
  expect(firstProcessResponse.json().task.status).toBe("failed");

  return executionTask;
};

describe.runIf(hasTestDatabase)("Support and observability integration", () => {
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

  it("propagates correlation IDs through support execution requeue and enforces tenant isolation", async () => {
    const owner = await createUser(prisma, {
      email: "support-owner@example.com",
      displayName: "Support Owner",
    });
    const outsider = await createUser(prisma, {
      email: "support-outsider@example.com",
      displayName: "Support Outsider",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Support Org",
      slug: "support-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Support Other Org",
      slug: "support-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const executionTask = await setupFailedExecutionTask(app, prisma, {
      userId: owner.id,
      organizationId: organization.id,
    });

    const correlationId = "11d16a0f-6b58-4c06-b35d-c8a8d63dacf5";
    const requeueResponse = await app.inject({
      method: "POST",
      url: `/support/executions/${executionTask.id}/requeue`,
      headers: {
        ...buildAuthHeaders(owner.id, organization.id),
        "x-correlation-id": correlationId,
      },
      payload: {
        reason: "Support replay after transient failure.",
      },
    });

    expect(requeueResponse.statusCode).toBe(200);
    expect(requeueResponse.json().status).toBe("pending");

    const supportAuditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        eventType: "support.execution.requeued",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(supportAuditEvent.correlationId).toBe(correlationId);

    const outsiderReadResponse = await app.inject({
      method: "GET",
      url: `/support/executions/${executionTask.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });
    expect(outsiderReadResponse.statusCode).toBe(404);
  });

  it("requeues failed forecast jobs and exposes metrics plus worker diagnostics", async () => {
    const owner = await createUser(prisma, {
      email: "support-forecast-owner@example.com",
      displayName: "Support Forecast Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Support Forecast Org",
      slug: "support-forecast-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const failedJob = await prisma.forecastJob.create({
      data: {
        organizationId: organization.id,
        status: ForecastJobStatus.failed,
        requestedByUserId: owner.id,
        scopeType: ForecastScopeType.organization,
        scopeReference: Prisma.JsonNull,
        horizonDays: 7,
        modelType: ForecastModelType.baseline_recent_average,
        inputSnapshot: {
          anchorDate: "2026-03-28T00:00:00.000Z",
          demandSignalCreatedAtCutoff: "2026-03-28T00:00:00.000Z",
          lookbackDays: 14,
          horizonDays: 7,
          modelType: ForecastModelType.baseline_recent_average,
          scopeType: ForecastScopeType.organization,
          scopeReference: null,
        },
        errorMessage: "Injected failure",
        completedAt: new Date("2026-03-28T00:30:00.000Z"),
      },
    });

    const requeueResponse = await app.inject({
      method: "POST",
      url: `/support/forecast-jobs/${failedJob.id}/requeue`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        reason: "Replay failed forecast job",
      },
    });

    expect(requeueResponse.statusCode).toBe(200);
    expect(requeueResponse.json().status).toBe("pending");

    await prisma.workerRun.create({
      data: {
        workerType: WorkerType.forecast,
        status: WorkerRunStatus.failed,
        correlationId: "2ae5470f-2846-4fe1-a6b8-fc2c4114c881",
        startedAt: new Date("2026-03-28T01:00:00.000Z"),
        completedAt: new Date("2026-03-28T01:05:00.000Z"),
        processedCount: 0,
        errorMessage: "Worker failure",
      },
    });

    const workerStatusResponse = await app.inject({
      method: "GET",
      url: "/support/worker-status",
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(workerStatusResponse.statusCode).toBe(200);
    expect(workerStatusResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workerType: "forecast",
        }),
      ]),
    );

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/observability/metrics",
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json()).toEqual(
      expect.objectContaining({
        counters: expect.any(Array),
        gauges: expect.any(Array),
        timers: expect.any(Array),
      }),
    );
  });

  it("recomputes outcomes through support actions and records audit plus outbox events", async () => {
    const owner = await createUser(prisma, {
      email: "support-outcomes-owner@example.com",
      displayName: "Support Outcomes Owner",
    });
    const viewer = await createUser(prisma, {
      email: "support-viewer@example.com",
      displayName: "Support Viewer",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Support Outcomes Org",
      slug: "support-outcomes-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });

    const recomputeResponse = await app.inject({
      method: "POST",
      url: "/support/outcomes/recompute",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: "2026-03-21T00:00:00.000Z",
        measurementWindowEnd: "2026-03-28T00:00:00.000Z",
      },
    });

    expect(recomputeResponse.statusCode).toBe(200);
    expect(recomputeResponse.json()).toEqual(
      expect.objectContaining({
        measurementWindowStart: "2026-03-21T00:00:00.000Z",
        measurementWindowEnd: "2026-03-28T00:00:00.000Z",
      }),
    );

    const outcomesReadResponse = await app.inject({
      method: "GET",
      url: "/support/outcomes",
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(outcomesReadResponse.statusCode).toBe(200);
    expect(outcomesReadResponse.json()).toEqual(
      expect.objectContaining({
        decisionOutcomes: expect.any(Array),
        fillRates: expect.any(Array),
        forecastErrors: expect.any(Array),
        stockouts: expect.any(Array),
        policySummaries: expect.any(Array),
      }),
    );

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: "support.outcome.recomputed",
      },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: "support.outcome.recomputed.v1",
      },
    });

    expect(auditEvents).toHaveLength(1);
    expect(outboxEvents).toHaveLength(1);

    const viewerMutationResponse = await app.inject({
      method: "POST",
      url: "/support/outcomes/recompute",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        measurementWindowStart: "2026-03-21T00:00:00.000Z",
        measurementWindowEnd: "2026-03-28T00:00:00.000Z",
      },
    });

    expect(viewerMutationResponse.statusCode).toBe(403);
  });

  it("returns tenant-scoped support forecast diagnostics", async () => {
    const owner = await createUser(prisma, {
      email: "support-list-owner@example.com",
      displayName: "Support List Owner",
    });
    const outsider = await createUser(prisma, {
      email: "support-list-outsider@example.com",
      displayName: "Support List Outsider",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Support List Org",
      slug: "support-list-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Support List Other Org",
      slug: "support-list-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    await prisma.forecastJob.createMany({
      data: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          organizationId: organization.id,
          status: ForecastJobStatus.pending,
          requestedByUserId: owner.id,
          scopeType: ForecastScopeType.organization,
          scopeReference: Prisma.JsonNull,
          horizonDays: 7,
          modelType: ForecastModelType.baseline_recent_average,
          inputSnapshot: {},
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          organizationId: outsiderOrganization.id,
          status: ForecastJobStatus.pending,
          requestedByUserId: outsider.id,
          scopeType: ForecastScopeType.organization,
          scopeReference: Prisma.JsonNull,
          horizonDays: 7,
          modelType: ForecastModelType.baseline_recent_average,
          inputSnapshot: {},
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: "/support/forecast-jobs",
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].organizationId).toBe(organization.id);
  });
});
