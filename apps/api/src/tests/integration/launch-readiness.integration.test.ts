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
      name: "Demo Bridge",
      configJson: {
        sourceLabel: "launch-readiness",
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

describe.runIf(hasTestDatabase)("Phase 12 launch readiness", () => {
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

  it("exposes live, ready, and health endpoints and rate-limits sensitive billing mutations", async () => {
    const liveResponse = await app.inject({
      method: "GET",
      url: "/observability/live",
    });
    expect(liveResponse.statusCode).toBe(200);
    expect(liveResponse.json()).toEqual(
      expect.objectContaining({
        status: "ok",
        environment: "test",
      }),
    );

    const readyResponse = await app.inject({
      method: "GET",
      url: "/observability/ready",
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json()).toEqual(
      expect.objectContaining({
        status: "ready",
      }),
    );

    const healthResponse = await app.inject({
      method: "GET",
      url: "/observability/health",
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual(
      expect.objectContaining({
        status: "ok",
        readiness: "ready",
      }),
    );

    const owner = await createUser(prisma, {
      email: "rate-limit-owner@example.com",
      displayName: "Rate Limit Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Rate Limit Org",
      slug: "rate-limit-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const limitedApp = await createTestApp(prisma, {
      RATE_LIMIT_BILLING_MUTATIONS: 2,
      RATE_LIMIT_WINDOW_SECONDS: 60,
    });

    try {
      const headers = buildAuthHeaders(owner.id, organization.id);
      const first = await limitedApp.inject({
        method: "POST",
        url: "/billing/checkout-session",
        headers,
        payload: {
          planCode: "growth",
        },
      });
      const second = await limitedApp.inject({
        method: "POST",
        url: "/billing/checkout-session",
        headers,
        payload: {
          planCode: "growth",
        },
      });
      const third = await limitedApp.inject({
        method: "POST",
        url: "/billing/checkout-session",
        headers,
        payload: {
          planCode: "growth",
        },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(third.statusCode).toBe(429);
      expect(third.json()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "rate_limit_exceeded",
          }),
        }),
      );
    } finally {
      await limitedApp.close();
    }
  });

  it("covers the critical pilot flow from ingestion through workflow execution, outcomes, support reads, and billing visibility", async () => {
    const owner = await createUser(prisma, {
      email: "launch-owner@example.com",
      displayName: "Launch Owner",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Launch Readiness Org",
      slug: "launch-readiness-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });

    const headers = buildAuthHeaders(owner.id, organization.id);
    const connection = await createIntegrationConnection(app, owner.id, organization.id);

    const catalogSync = await createSyncRun(app, owner.id, organization.id, {
      connectionId: connection.id,
      syncType: "catalog_import",
      direction: "inbound",
      inputPayload: {
        records: [
          {
            kind: "catalog_sku",
            sourceReference: "launch-sku-001",
            payload: {
              skuCode: "LAUNCH-SKU-001",
              name: "Launch Demo SKU",
              baseUom: "each",
              packSize: 1,
              status: "active",
            },
          },
          {
            kind: "location",
            sourceReference: "launch-location-001",
            payload: {
              code: "LAUNCH-WH-001",
              name: "Launch Warehouse",
              type: "warehouse",
              status: "active",
            },
          },
        ],
      },
    });
    await processSyncRun(app, owner.id, organization.id, catalogSync.id);

    const sku = await prisma.sku.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        skuCode: "LAUNCH-SKU-001",
      },
    });
    const location = await prisma.location.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        code: "LAUNCH-WH-001",
      },
    });

    const supplierResponse = await app.inject({
      method: "POST",
      url: "/supply/suppliers",
      headers,
      payload: {
        code: "LAUNCH-SUP-001",
        name: "Launch Supplier",
      },
    });
    expect(supplierResponse.statusCode).toBe(201);
    const supplier = supplierResponse.json();

    const supplierSkuResponse = await app.inject({
      method: "POST",
      url: "/supply/supplier-skus",
      headers,
      payload: {
        supplierId: supplier.id,
        skuId: sku.id,
        isPrimary: true,
        minOrderQty: 12,
        casePackQty: 6,
        unitCost: 18.5,
        leadTimeDays: 5,
      },
    });
    expect(supplierSkuResponse.statusCode).toBe(201);

    const demandSync = await createSyncRun(app, owner.id, organization.id, {
      connectionId: connection.id,
      syncType: "demand_import",
      direction: "inbound",
      inputPayload: {
        records: [
          {
            kind: "historical_sale",
            sourceReference: "launch-sale-001",
            payload: {
              skuCode: "LAUNCH-SKU-001",
              locationCode: "LAUNCH-WH-001",
              quantity: 20,
              soldAt: "2026-03-20T10:00:00.000Z",
              sourceType: "integration_import",
            },
          },
          {
            kind: "historical_sale",
            sourceReference: "launch-sale-002",
            payload: {
              skuCode: "LAUNCH-SKU-001",
              locationCode: "LAUNCH-WH-001",
              quantity: 22,
              soldAt: "2026-03-21T10:00:00.000Z",
              sourceType: "integration_import",
            },
          },
          {
            kind: "historical_sale",
            sourceReference: "launch-sale-003",
            payload: {
              skuCode: "LAUNCH-SKU-001",
              locationCode: "LAUNCH-WH-001",
              quantity: 24,
              soldAt: "2026-03-22T10:00:00.000Z",
              sourceType: "integration_import",
            },
          },
        ],
      },
    });
    await processSyncRun(app, owner.id, organization.id, demandSync.id);

    const inventorySync = await createSyncRun(app, owner.id, organization.id, {
      connectionId: connection.id,
      syncType: "inventory_import",
      direction: "inbound",
      inputPayload: {
        records: [
          {
            kind: "inventory_snapshot",
            sourceReference: "launch-snapshot-001",
            payload: {
              skuCode: "LAUNCH-SKU-001",
              locationCode: "LAUNCH-WH-001",
              onHandQty: 5,
            },
          },
        ],
      },
    });
    await processSyncRun(app, owner.id, organization.id, inventorySync.id);

    const policyResponse = await app.inject({
      method: "POST",
      url: "/decisioning/policies",
      headers,
      payload: {
        policyType: "replenishment",
        name: "Launch Policy",
        version: 1,
        rulesJson: {
          automationTier: "recommend",
          forecastHorizonDays: 14,
          targetDaysOfCover: 14,
          leadTimeBufferDays: 1,
          defaultLeadTimeDays: 5,
          useSafetyStock: true,
          shortageBufferQty: 0,
          demandSpikeMultiplier: 2,
        },
      },
    });
    expect(policyResponse.statusCode).toBe(201);
    const policy = policyResponse.json();

    const activatePolicyResponse = await app.inject({
      method: "POST",
      url: `/decisioning/policies/${policy.id}/activate`,
      headers,
    });
    expect(activatePolicyResponse.statusCode).toBe(200);

    const forecastJobResponse = await app.inject({
      method: "POST",
      url: "/forecasting/jobs",
      headers,
      payload: {
        scopeType: "sku_location",
        skuId: sku.id,
        locationId: location.id,
        horizonDays: 14,
        modelType: "baseline_recent_average",
      },
    });
    expect(forecastJobResponse.statusCode).toBe(201);
    const forecastJob = forecastJobResponse.json();

    const processedForecastResponse = await app.inject({
      method: "POST",
      url: `/forecasting/jobs/${forecastJob.id}/process`,
      headers,
    });
    expect(processedForecastResponse.statusCode).toBe(200);
    expect(processedForecastResponse.json().results.length).toBeGreaterThan(0);

    const replenishmentResponse = await app.inject({
      method: "POST",
      url: "/decisioning/replenishment/generate",
      headers,
      payload: {
        skuId: sku.id,
        locationId: location.id,
      },
    });
    expect(replenishmentResponse.statusCode).toBe(200);
    const replenishmentResult = replenishmentResponse.json();
    expect(replenishmentResult.generated).toBe(true);
    expect(replenishmentResult.decision).not.toBeNull();

    const requestExecutionResponse = await app.inject({
      method: "POST",
      url: `/workflow/decisions/${replenishmentResult.decision.id}/request-execution`,
      headers,
    });
    expect(requestExecutionResponse.statusCode).toBe(201);
    const executionRequest = requestExecutionResponse.json();
    expect(executionRequest.routedToApproval).toBe(true);
    expect(executionRequest.approvalTask).not.toBeNull();

    const approveResponse = await app.inject({
      method: "POST",
      url: `/workflow/approvals/${executionRequest.approvalTask.id}/approve`,
      headers,
      payload: {
        comment: "Approved for launch-readiness flow.",
      },
    });
    expect(approveResponse.statusCode).toBe(200);
    const approvalResult = approveResponse.json();
    expect(approvalResult.executionTask).not.toBeNull();

    const processExecutionResponse = await app.inject({
      method: "POST",
      url: `/workflow/executions/${approvalResult.executionTask.id}/process`,
      headers,
    });
    expect(processExecutionResponse.statusCode).toBe(200);
    expect(processExecutionResponse.json().task.status).toBe("succeeded");

    const measurementWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const measurementWindowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const recomputeResponse = await app.inject({
      method: "POST",
      url: "/support/outcomes/recompute",
      headers,
      payload: {
        measurementWindowStart,
        measurementWindowEnd,
      },
    });
    expect(recomputeResponse.statusCode).toBe(200);

    const supportOutcomesResponse = await app.inject({
      method: "GET",
      url: "/support/outcomes",
      headers,
    });
    expect(supportOutcomesResponse.statusCode).toBe(200);
    expect(supportOutcomesResponse.json()).toEqual(
      expect.objectContaining({
        decisionOutcomes: expect.any(Array),
      }),
    );

    const supportExecutionsResponse = await app.inject({
      method: "GET",
      url: "/support/executions",
      headers,
    });
    expect(supportExecutionsResponse.statusCode).toBe(200);
    expect(supportExecutionsResponse.json().length).toBeGreaterThan(0);

    const entitlementsResponse = await app.inject({
      method: "GET",
      url: "/billing/entitlements",
      headers,
    });
    expect(entitlementsResponse.statusCode).toBe(200);
    expect(entitlementsResponse.json()).toEqual(
      expect.objectContaining({
        organizationId: organization.id,
        entitlements: expect.any(Object),
      }),
    );

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
      },
    });
    const supportAuditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: "support.outcome.recomputed",
      },
    });

    expect(purchaseOrders.length).toBeGreaterThan(0);
    expect(supportAuditEvents.length).toBeGreaterThan(0);
  });
});
