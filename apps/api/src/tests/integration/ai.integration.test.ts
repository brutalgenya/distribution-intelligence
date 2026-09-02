import {
  AiModelType,
  AutomationTier,
  DecisionStatus,
  DecisionType,
  ForecastModelType,
  ForecastScopeType,
  PolicyStatus,
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

const createModel = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  payload: {
    provider: string;
    modelName: string;
    modelVersion: string;
    modelType: AiModelType;
    promptVersion?: string;
    schemaVersion: string;
    status: "active" | "inactive" | "deprecated";
  },
) => {
  const response = await app.inject({
    method: "POST",
    url: "/ai/models",
    headers: buildAuthHeaders(userId, organizationId),
    payload,
  });

  expect(response.statusCode).toBe(200);
  return response.json();
};

const createSku = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  skuCode: string,
) => {
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

const createLocation = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  code: string,
) => {
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

const createForecastJob = async (
  app: FastifyInstance,
  userId: string,
  organizationId: string,
  skuId: string,
  locationId: string,
) => {
  const response = await app.inject({
    method: "POST",
    url: "/forecasting/jobs",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      scopeType: ForecastScopeType.sku_location,
      skuId,
      locationId,
      horizonDays: 3,
      modelType: ForecastModelType.baseline_recent_average,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

describe.runIf(hasTestDatabase)("AI integration", () => {
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

  it("registers models, enhances forecasts with fallback, persists anomalies and explanations, and enforces permissions", async () => {
    const owner = await createUser(prisma, {
      email: "ai-owner@example.com",
      displayName: "AI Owner",
    });
    const viewer = await createUser(prisma, {
      email: "ai-viewer@example.com",
      displayName: "AI Viewer",
    });
    const outsider = await createUser(prisma, {
      email: "ai-outsider@example.com",
      displayName: "AI Outsider",
    });

    const organization = await createOrganizationWithMembership(prisma, {
      name: "AI Org",
      slug: "ai-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "AI Other Org",
      slug: "ai-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const sku = await createSku(app, owner.id, organization.id, "AI-SKU-001");
    const location = await createLocation(app, owner.id, organization.id, "AI-MAIN");

    const now = new Date("2026-03-28T00:00:00.000Z");
    await prisma.demandSignal.createMany({
      data: [
        {
          organizationId: organization.id,
          skuId: sku.id,
          locationId: location.id,
          signalType: "historical_sale",
          quantity: 8,
          observedAt: new Date("2026-03-26T12:00:00.000Z"),
          sourceType: "seeded",
          sourceReference: "sig-1",
        },
        {
          organizationId: organization.id,
          skuId: sku.id,
          locationId: location.id,
          signalType: "historical_sale",
          quantity: 10,
          observedAt: new Date("2026-03-27T12:00:00.000Z"),
          sourceType: "seeded",
          sourceReference: "sig-2",
        },
        {
          organizationId: organization.id,
          skuId: sku.id,
          locationId: location.id,
          signalType: "historical_sale",
          quantity: 14,
          observedAt: new Date("2026-03-28T12:00:00.000Z"),
          sourceType: "seeded",
          sourceReference: "sig-3",
        },
      ],
    });

    const forecastJob = await createForecastJob(app, owner.id, organization.id, sku.id, location.id);

    const processBaselineResponse = await app.inject({
      method: "POST",
      url: `/forecasting/jobs/${forecastJob.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(processBaselineResponse.statusCode).toBe(200);
    expect(processBaselineResponse.json().job.status).toBe("completed");

    const forecastModel = await createModel(app, owner.id, organization.id, {
      provider: "mock",
      modelName: "mock-forecast-enhancer",
      modelVersion: "v1",
      modelType: AiModelType.forecast_enhancement,
      promptVersion: "p1",
      schemaVersion: "2026-03-28",
      status: "active",
    });

    const enhanceResponse = await app.inject({
      method: "POST",
      url: "/ai/forecasting/enhance",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        forecastJobId: forecastJob.id,
      },
    });
    expect(enhanceResponse.statusCode).toBe(200);
    expect(enhanceResponse.json().status).toBe("succeeded");
    expect(enhanceResponse.json().enhancedResults[0].provider).toBe("mock");
    expect(enhanceResponse.json().enhancedResults[0].modelRegistryEntryId).toBe(forecastModel.id);

    const degradedJob = await createForecastJob(app, owner.id, organization.id, sku.id, location.id);
    const degradedProcessResponse = await app.inject({
      method: "POST",
      url: `/forecasting/jobs/${degradedJob.id}/process`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(degradedProcessResponse.statusCode).toBe(200);

    await createModel(app, owner.id, organization.id, {
      provider: "mock",
      modelName: "mock-invalid-forecast-enhancer",
      modelVersion: "v2",
      modelType: AiModelType.forecast_enhancement,
      promptVersion: "p2",
      schemaVersion: "2026-03-28",
      status: "active",
    });

    const degradedEnhanceResponse = await app.inject({
      method: "POST",
      url: "/ai/forecasting/enhance",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        forecastJobId: degradedJob.id,
      },
    });
    expect(degradedEnhanceResponse.statusCode).toBe(200);
    expect(degradedEnhanceResponse.json().status).toBe("degraded");
    expect(degradedEnhanceResponse.json().baselineFallbackUsed).toBe(true);

    await createModel(app, owner.id, organization.id, {
      provider: "mock",
      modelName: "mock-anomaly-scorer",
      modelVersion: "v1",
      modelType: AiModelType.anomaly_scoring,
      schemaVersion: "2026-03-28",
      status: "active",
    });

    const viewerAnomalyResponse = await app.inject({
      method: "POST",
      url: "/ai/anomalies/score",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        measurementWindowStart: "2026-03-27T00:00:00.000Z",
        measurementWindowEnd: "2026-03-29T00:00:00.000Z",
        skuId: sku.id,
        locationId: location.id,
      },
    });
    expect(viewerAnomalyResponse.statusCode).toBe(403);

    const anomalyResponse = await app.inject({
      method: "POST",
      url: "/ai/anomalies/score",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        measurementWindowStart: "2026-03-27T00:00:00.000Z",
        measurementWindowEnd: "2026-03-29T00:00:00.000Z",
        skuId: sku.id,
        locationId: location.id,
      },
    });
    expect(anomalyResponse.statusCode).toBe(200);
    expect(anomalyResponse.json().status).toBe("succeeded");
    expect(anomalyResponse.json().anomalyScore.modelName).toBe("mock-anomaly-scorer");

    await createModel(app, owner.id, organization.id, {
      provider: "mock",
      modelName: "mock-decision-explainer",
      modelVersion: "v1",
      modelType: AiModelType.decision_explanation,
      schemaVersion: "2026-03-28",
      status: "active",
    });

    const policy = await prisma.policy.create({
      data: {
        organizationId: organization.id,
        policyType: PolicyType.replenishment,
        name: "AI Decision Policy",
        version: 1,
        status: PolicyStatus.active,
        rulesJson: {
          automationTier: AutomationTier.recommend,
        },
        createdByUserId: owner.id,
      },
    });

    const decision = await prisma.decision.create({
      data: {
        organizationId: organization.id,
        decisionType: DecisionType.replenishment,
        status: DecisionStatus.proposed,
        automationTier: AutomationTier.recommend,
        policyId: policy.id,
        policyVersion: policy.version,
        skuId: sku.id,
        locationId: location.id,
        proposedPayload: {
          recommendedOrderQty: 12,
        },
        rationale: {
          deterministic: true,
        },
        createdByUserId: owner.id,
      },
    });
    await prisma.decisionReason.create({
      data: {
        decisionId: decision.id,
        code: "reorder_point_breached",
        message: "Reorder point was breached.",
      },
    });

    const explainResponse = await app.inject({
      method: "POST",
      url: `/ai/decisions/${decision.id}/explain`,
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(explainResponse.statusCode).toBe(200);
    expect(explainResponse.json().status).toBe("succeeded");
    const explanationId = explainResponse.json().explanation.id;

    const outsiderExplanationResponse = await app.inject({
      method: "GET",
      url: `/ai/decisions/explanations/${explanationId}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });
    expect(outsiderExplanationResponse.statusCode).toBe(404);

    const aiRuns = await prisma.aiRun.findMany({
      where: { organizationId: organization.id },
      include: { modelRegistryEntry: true },
      orderBy: { createdAt: "asc" },
    });
    expect(aiRuns.length).toBeGreaterThanOrEqual(4);
    expect(aiRuns.some((run) => run.modelRegistryEntry.modelType === AiModelType.forecast_enhancement)).toBe(true);
    expect(aiRuns.some((run) => run.status === "degraded")).toBe(true);

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: {
          in: [
            "ai.model.registered",
            "ai.run.started",
            "ai.run.succeeded",
            "ai.run.degraded",
            "forecast.enhanced",
            "anomaly.scored",
            "decision.explanation.generated",
          ],
        },
      },
    });
    expect(auditEvents.length).toBeGreaterThan(0);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: {
          in: [
            "ai.model.registered.v1",
            "ai.run.started.v1",
            "ai.run.succeeded.v1",
            "ai.run.degraded.v1",
            "forecast.enhanced.v1",
            "anomaly.scored.v1",
            "decision.explanation.generated.v1",
          ],
        },
      },
    });
    expect(outboxEvents.length).toBeGreaterThan(0);
  });
});
