import {
  AiModelType,
  BillingPlanStatus,
  ModelRegistryStatus,
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

const createSku = async (app: FastifyInstance, userId: string, organizationId: string) => {
  const response = await app.inject({
    method: "POST",
    url: "/catalog/skus",
    headers: buildAuthHeaders(userId, organizationId),
    payload: {
      skuCode: "BILL-SKU-001",
      name: "Billing SKU",
      baseUom: "each",
      packSize: 1,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json();
};

describe.runIf(hasTestDatabase)("Billing integration", () => {
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

  it("creates a checkout session and processes a Stripe subscription webhook idempotently", async () => {
    const owner = await createUser(prisma, {
      email: "billing-owner@example.com",
      displayName: "Billing Owner",
    });
    const outsider = await createUser(prisma, {
      email: "billing-outsider@example.com",
      displayName: "Billing Outsider",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Billing Org",
      slug: "billing-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    const outsiderOrganization = await createOrganizationWithMembership(prisma, {
      name: "Billing Other Org",
      slug: "billing-other-org",
      userId: outsider.id,
      roleCode: RoleCode.owner,
    });

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/billing/checkout-session",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        planCode: "growth",
      },
    });

    expect(checkoutResponse.statusCode).toBe(201);
    const checkoutSession = checkoutResponse.json();
    expect(checkoutSession.planCode).toBe("growth");

    const webhookPayload = {
      id: "evt_billing_sub_created_001",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_growth_001",
          customer: checkoutSession.customerId,
          status: "active",
          current_period_start: 1772323200,
          current_period_end: 1774915200,
          cancel_at_period_end: false,
          metadata: {
            organizationId: organization.id,
          },
          items: {
            data: [
              {
                price: {
                  id: "price_growth_monthly",
                },
              },
            ],
          },
        },
      },
    };

    const firstWebhookResponse = await app.inject({
      method: "POST",
      url: "/billing/webhooks/stripe",
      payload: JSON.stringify(webhookPayload),
      headers: {
        "content-type": "application/json",
      },
    });
    expect(firstWebhookResponse.statusCode).toBe(200);
    expect(firstWebhookResponse.json().deduplicated).toBe(false);

    const secondWebhookResponse = await app.inject({
      method: "POST",
      url: "/billing/webhooks/stripe",
      payload: JSON.stringify(webhookPayload),
      headers: {
        "content-type": "application/json",
      },
    });
    expect(secondWebhookResponse.statusCode).toBe(200);
    expect(secondWebhookResponse.json().deduplicated).toBe(true);

    const subscriptionResponse = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(subscriptionResponse.statusCode).toBe(200);
    expect(subscriptionResponse.json()).toEqual(
      expect.objectContaining({
        status: "active",
        stripeSubscriptionId: "sub_growth_001",
        plan: expect.objectContaining({
          code: "growth",
        }),
      }),
    );

    const entitlementsResponse = await app.inject({
      method: "GET",
      url: "/billing/entitlements",
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(entitlementsResponse.statusCode).toBe(200);
    expect(entitlementsResponse.json()).toEqual(
      expect.objectContaining({
        entitlements: expect.objectContaining({
          maxUsers: expect.any(Number),
        }),
      }),
    );

    const stripeEventsResponse = await app.inject({
      method: "GET",
      url: "/billing/stripe-events",
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(stripeEventsResponse.statusCode).toBe(200);
    expect(stripeEventsResponse.json()).toHaveLength(1);

    const stripeEventLogId = stripeEventsResponse.json()[0].id as string;
    const outsiderReadResponse = await app.inject({
      method: "GET",
      url: `/billing/stripe-events/${stripeEventLogId}`,
      headers: buildAuthHeaders(outsider.id, outsiderOrganization.id),
    });
    expect(outsiderReadResponse.statusCode).toBe(404);

    const eventLogs = await prisma.stripeEventLog.findMany({
      where: {
        organizationId: organization.id,
      },
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: {
          in: ["billing.checkout.created", "billing.subscription.updated", "billing.stripe_event.processed"],
        },
      },
    });
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        organizationId: organization.id,
        eventType: {
          in: ["billing.checkout.created.v1", "billing.subscription.updated.v1"],
        },
      },
    });

    expect(eventLogs).toHaveLength(1);
    expect(auditEvents.length).toBeGreaterThanOrEqual(3);
    expect(outboxEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("enforces forecast and AI plan limits and exposes persisted usage meters", async () => {
    const owner = await createUser(prisma, {
      email: "billing-limits-owner@example.com",
      displayName: "Billing Limits Owner",
    });
    const viewer = await createUser(prisma, {
      email: "billing-limits-viewer@example.com",
      displayName: "Billing Limits Viewer",
    });
    const organization = await createOrganizationWithMembership(prisma, {
      name: "Billing Limits Org",
      slug: "billing-limits-org",
      userId: owner.id,
      roleCode: RoleCode.owner,
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: viewer.id,
      roleCode: RoleCode.viewer,
    });

    const sku = await createSku(app, owner.id, organization.id);

    const usageResponse = await app.inject({
      method: "GET",
      url: "/billing/usage",
      headers: buildAuthHeaders(owner.id, organization.id),
    });
    expect(usageResponse.statusCode).toBe(200);
    expect(usageResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meterType: "skus",
        }),
      ]),
    );

    const subscription = await prisma.planSubscription.findUniqueOrThrow({
      where: {
        organizationId: organization.id,
      },
    });
    const billingPlan = await prisma.billingPlan.findUniqueOrThrow({
      where: {
        id: subscription.billingPlanId,
      },
    });

    await prisma.billingPlan.update({
      where: { id: billingPlan.id },
      data: {
        maxForecastJobsPerPeriod: 0,
        maxAiRunsPerPeriod: 0,
      },
    });

    const forecastJobResponse = await app.inject({
      method: "POST",
      url: "/forecasting/jobs",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        scopeType: "organization",
        horizonDays: 7,
        modelType: "baseline_recent_average",
      },
    });
    expect(forecastJobResponse.statusCode).toBe(402);

    await prisma.modelRegistryEntry.create({
      data: {
        id: "00000000-0000-0000-0000-00000000b810",
        provider: "mock",
        modelName: "billing-anomaly-model",
        modelVersion: "v1",
        modelType: AiModelType.anomaly_scoring,
        schemaVersion: "2026-03-28",
        status: ModelRegistryStatus.active,
      },
    });

    const anomalyResponse = await app.inject({
      method: "POST",
      url: "/ai/anomalies/score",
      headers: buildAuthHeaders(owner.id, organization.id),
      payload: {
        skuId: sku.id,
        measurementWindowStart: "2026-03-01T00:00:00.000Z",
        measurementWindowEnd: "2026-03-28T00:00:00.000Z",
      },
    });
    expect(anomalyResponse.statusCode).toBe(402);

    const viewerCheckoutResponse = await app.inject({
      method: "POST",
      url: "/billing/checkout-session",
      headers: buildAuthHeaders(viewer.id, organization.id),
      payload: {
        planCode: "growth",
      },
    });
    expect(viewerCheckoutResponse.statusCode).toBe(403);
  });
});
