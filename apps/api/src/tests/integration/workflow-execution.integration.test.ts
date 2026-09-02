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

const setupReplenishmentDecision = async (
  prisma: PrismaClient,
  app: FastifyInstance,
  input: {
    userId: string;
    organizationId: string;
    automationTier: AutomationTier;
    skuCode: string;
    locationCode: string;
    supplierCode: string;
  },
) => {
  const sku = await createSku(app, input.userId, input.organizationId, {
    skuCode: input.skuCode,
    name: `${input.skuCode} Widget`,
  });
  const location = await createLocation(app, input.userId, input.organizationId, {
    code: input.locationCode,
    name: `${input.locationCode} Warehouse`,
  });
  const supplier = await createSupplier(app, input.userId, input.organizationId, {
    code: input.supplierCode,
    name: `${input.supplierCode} Supply`,
  });

  await createSupplierSku(app, input.userId, input.organizationId, {
    supplierId: supplier.id,
    skuId: sku.id,
    minOrderQty: 12,
    casePackQty: 6,
    leadTimeDays: 2,
  });

  await createActivePolicy(app, input.userId, input.organizationId, {
    policyType: "replenishment",
    name: `${input.skuCode} Replenishment`,
    version: 1,
    rulesJson: {
      automationTier: input.automationTier,
      forecastHorizonDays: 5,
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
      forecastHorizonDays: 5,
      leadTimeDriftThresholdDays: 3,
      demandSpikeMultiplier: 2,
      stockoutRiskCoverDays: 3,
    },
  });

  await receiveInventory(app, input.userId, input.organizationId, {
    skuId: sku.id,
    locationId: location.id,
    quantity: 7,
    referenceId: `PO-${input.skuCode}`,
  });

  await createCompletedForecast(prisma, {
    organizationId: input.organizationId,
    requestedByUserId: input.userId,
    skuId: sku.id,
    locationId: location.id,
    quantities: [4, 4, 4, 4, 4],
    completedAt: new Date("2026-03-28T01:00:00.000Z"),
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

  return { decision, sku, location, supplier };
};

const setupAllocationDecision = async (
  app: FastifyInstance,
  input: {
    userId: string;
    organizationId: string;
    automationTier: AutomationTier;
    skuCode: string;
    locationCode: string;
  },
) => {
  const sku = await createSku(app, input.userId, input.organizationId, {
    skuCode: input.skuCode,
    name: `${input.skuCode} Allocation SKU`,
  });
  const location = await createLocation(app, input.userId, input.organizationId, {
    code: input.locationCode,
    name: `${input.locationCode} Allocation Warehouse`,
  });

  await createActivePolicy(app, input.userId, input.organizationId, {
    policyType: "allocation",
    name: `${input.skuCode} Allocation`,
    version: 1,
    rulesJson: {
      automationTier: input.automationTier,
      shortageThresholdQty: 1,
      prioritizationMode: "oldest_order_first",
      maxAffectedOrders: 10,
    },
  });

  await receiveInventory(app, input.userId, input.organizationId, {
    skuId: sku.id,
    locationId: location.id,
    quantity: 5,
    referenceId: `PO-${input.skuCode}`,
  });

  await createCustomerOrder(app, input.userId, input.organizationId, {
    orderNumber: `${input.skuCode}-SO-001`,
    orderedAt: "2026-03-20T00:00:00.000Z",
    skuId: sku.id,
    locationId: location.id,
    quantity: 3,
  });
  await createCustomerOrder(app, input.userId, input.organizationId, {
    orderNumber: `${input.skuCode}-SO-002`,
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

  return { decision, sku, location };
};

describe.runIf(hasTestDatabase)("Workflow and execution integration", () => {
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

  it("requests approval for a decision, rejects idempotently, and enforces viewer denial plus tenant isolation", async () => {
    const owner = await createUser(prisma, {
      email: "workflow-owner@example.com",
      displayName: "Workflow Owner",
    });
    const viewer = await createUser(prisma, {
      email: "workflow-viewer@example.com",
      displayName: "Workflow Viewer",
    });
    const outsider = await createUser(prisma, {
      email: "workflow-outsider@example.com",
      displayName: "Workflow Outsider",
    });

    const organization = await createOrganizationWithMembership(prisma, {
      name: "Workflow Org",
      slug: "workflow-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Workflow Other Org",
      slug: "workflow-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const { decision } = await setupReplenishmentDecision(prisma, app, {
      userId: owner.id,
      organizationId: organization.id,
      automationTier: AutomationTier.recommend,
      skuCode: "WF-APP-001",
      locationCode: "WF-APP-MAIN",
      supplierCode: "WF-APP-SUP",
    });

    const viewerResponse = await app.inject({
      method: "POST",
      url: `/workflow/decisions/${decision.id}/request-approval`,
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {},
    });
    expect(viewerResponse.statusCode).toBe(403);

    const requestApprovalResponse = await app.inject({
      method: "POST",
      url: `/workflow/decisions/${decision.id}/request-approval`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        comment: "Please review before execution.",
      },
    });

    expect(requestApprovalResponse.statusCode).toBe(201);
    const approvalTask = requestApprovalResponse.json();
    expect(approvalTask.status).toBe("pending");

    const outsiderReadResponse = await app.inject({
      method: "GET",
      url: `/workflow/approvals/${approvalTask.id}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });
    expect(outsiderReadResponse.statusCode).toBe(404);

    const rejectResponse = await app.inject({
      method: "POST",
      url: `/workflow/approvals/${approvalTask.id}/reject`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        comment: "Hold this recommendation.",
      },
    });

    expect(rejectResponse.statusCode).toBe(200);
    expect(rejectResponse.json().approvalTask.status).toBe("rejected");

    const rejectAgainResponse = await app.inject({
      method: "POST",
      url: `/workflow/approvals/${approvalTask.id}/reject`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        comment: "Hold this recommendation.",
      },
    });

    expect(rejectAgainResponse.statusCode).toBe(200);
    expect(rejectAgainResponse.json().approvalTask.status).toBe("rejected");

    const persistedDecision = await prisma.decision.findUniqueOrThrow({
      where: { id: decision.id },
    });
    expect(persistedDecision.status).toBe("rejected");
  });

  it("routes recommend-tier execution through approval, approves idempotently, processes it, and avoids duplicate purchase orders", async () => {
    const owner = await createUser(prisma, {
      email: "workflow-execution-owner@example.com",
      displayName: "Workflow Execution Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Workflow Execution Org",
      slug: "workflow-execution-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const { decision } = await setupReplenishmentDecision(prisma, app, {
      userId: owner.id,
      organizationId: organization.id,
      automationTier: AutomationTier.recommend,
      skuCode: "WF-EXEC-001",
      locationCode: "WF-EXEC-MAIN",
      supplierCode: "WF-EXEC-SUP",
    });

    const requestExecutionResponse = await app.inject({
      method: "POST",
      url: `/workflow/decisions/${decision.id}/request-execution`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(requestExecutionResponse.statusCode).toBe(201);
    const executionRequest = requestExecutionResponse.json();
    expect(executionRequest.routedToApproval).toBe(true);
    expect(executionRequest.approvalTask.purpose).toBe("execution_gate");

    const approveResponse = await app.inject({
      method: "POST",
      url: `/workflow/approvals/${executionRequest.approvalTask.id}/approve`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        comment: "Approved for execution.",
      },
    });

    expect(approveResponse.statusCode).toBe(200);
    const approvalResult = approveResponse.json();
    expect(approvalResult.executionTask.taskType).toBe("create_purchase_order");
    expect(approvalResult.decision.status).toBe("execution_requested");

    const approveAgainResponse = await app.inject({
      method: "POST",
      url: `/workflow/approvals/${executionRequest.approvalTask.id}/approve`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        comment: "Approved for execution.",
      },
    });

    expect(approveAgainResponse.statusCode).toBe(200);
    expect(approveAgainResponse.json().executionTask.id).toBe(approvalResult.executionTask.id);

    const processResponse = await app.inject({
      method: "POST",
      url: `/workflow/executions/${approvalResult.executionTask.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(processResponse.statusCode).toBe(200);
    expect(processResponse.json().processedNow).toBe(true);
    expect(processResponse.json().task.status).toBe("succeeded");

    const processAgainResponse = await app.inject({
      method: "POST",
      url: `/workflow/executions/${approvalResult.executionTask.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(processAgainResponse.statusCode).toBe(200);
    expect(processAgainResponse.json().processedNow).toBe(false);
    expect(processAgainResponse.json().task.status).toBe("succeeded");

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
    });
    expect(purchaseOrders).toHaveLength(1);
    expect(purchaseOrders[0]?.notes).toContain(decision.id);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });

    expect(auditEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "workflow.execution.requested",
        "workflow.execution.started",
        "workflow.execution.succeeded",
        "supply.purchase_order.created",
      ]),
    );
    expect(outboxEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "workflow.execution.requested.v1",
        "workflow.execution.started.v1",
        "workflow.execution.succeeded.v1",
        "supply.purchase_order.created.v1",
      ]),
    );
  });

  it("processes a retryable failure, retries successfully, and records audit plus outbox events", async () => {
    const owner = await createUser(prisma, {
      email: "workflow-retry-owner@example.com",
      displayName: "Workflow Retry Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Workflow Retry Org",
      slug: "workflow-retry-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const { decision } = await setupAllocationDecision(app, {
      userId: owner.id,
      organizationId: organization.id,
      automationTier: AutomationTier.auto_execute,
      skuCode: "WF-RETRY-001",
      locationCode: "WF-RETRY-MAIN",
    });

    const requestExecutionResponse = await app.inject({
      method: "POST",
      url: "/workflow/executions",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        decisionId: decision.id,
      },
    });

    expect(requestExecutionResponse.statusCode).toBe(201);
    const executionRequest = requestExecutionResponse.json();

    await prisma.executionTask.update({
      where: { id: executionRequest.executionTask.id },
      data: {
        payload: {
          decisionId: decision.id,
          summary: "Retryable notification",
          testFailureMode: "retryable",
          testFailureUntilAttemptNumber: 1,
        },
      },
    });

    const firstProcessResponse = await app.inject({
      method: "POST",
      url: `/workflow/executions/${executionRequest.executionTask.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(firstProcessResponse.statusCode).toBe(200);
    expect(firstProcessResponse.json().task.status).toBe("failed");
    expect(firstProcessResponse.json().task.retryCount).toBe(1);

    const retryResponse = await app.inject({
      method: "POST",
      url: `/workflow/executions/${executionRequest.executionTask.id}/retry`,
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        reason: "Retry after transient notification failure.",
      },
    });

    expect(retryResponse.statusCode).toBe(200);
    expect(retryResponse.json().status).toBe("pending");

    const secondProcessResponse = await app.inject({
      method: "POST",
      url: `/workflow/executions/${executionRequest.executionTask.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });

    expect(secondProcessResponse.statusCode).toBe(200);
    expect(secondProcessResponse.json().task.status).toBe("succeeded");

    const persistedDecision = await prisma.decision.findUniqueOrThrow({
      where: { id: decision.id },
    });
    expect(persistedDecision.status).toBe("executed");

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });
    expect(outboxEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "workflow.execution.failed.v1",
        "workflow.execution.requested.v1",
        "workflow.execution.succeeded.v1",
      ]),
    );
  });

  it("dead-letters execution tasks after the retry limit is reached", async () => {
    const owner = await createUser(prisma, {
      email: "workflow-deadletter-owner@example.com",
      displayName: "Workflow Dead Letter Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Workflow Dead Letter Org",
      slug: "workflow-deadletter-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const { decision } = await setupAllocationDecision(app, {
      userId: owner.id,
      organizationId: organization.id,
      automationTier: AutomationTier.auto_execute,
      skuCode: "WF-DLQ-001",
      locationCode: "WF-DLQ-MAIN",
    });

    const requestExecutionResponse = await app.inject({
      method: "POST",
      url: "/workflow/executions",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        decisionId: decision.id,
      },
    });

    expect(requestExecutionResponse.statusCode).toBe(201);
    const executionRequest = requestExecutionResponse.json();

    await prisma.executionTask.update({
      where: { id: executionRequest.executionTask.id },
      data: {
        payload: {
          decisionId: decision.id,
          summary: "Dead-letter notification",
          testFailureMode: "retryable",
          testFailureUntilAttemptNumber: 99,
        },
      },
    });

    for (let index = 0; index < 3; index += 1) {
      const processResponse = await app.inject({
        method: "POST",
        url: `/workflow/executions/${executionRequest.executionTask.id}/process`,
        headers: buildAuthHeaders(owner.id, organization.id),
      });

      expect(processResponse.statusCode).toBe(200);

      if (index < 2) {
        expect(processResponse.json().task.status).toBe("failed");

        const retryResponse = await app.inject({
          method: "POST",
          url: `/workflow/executions/${executionRequest.executionTask.id}/retry`,
          headers: buildAuthHeaders(owner.id, organization.id),
          payload: {
            reason: `Retry attempt ${index + 1}`,
          },
        });

        expect(retryResponse.statusCode).toBe(200);
        expect(retryResponse.json().status).toBe("pending");
      } else {
        expect(processResponse.json().task.status).toBe("dead_lettered");
        expect(processResponse.json().task.retryCount).toBe(3);
      }
    }

    const persistedDecision = await prisma.decision.findUniqueOrThrow({
      where: { id: decision.id },
    });
    expect(persistedDecision.status).toBe("execution_failed");

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { organizationId: organization.id },
    });
    expect(outboxEvents.map((event) => event.eventType)).toContain("workflow.execution.dead_lettered.v1");
  });
});
