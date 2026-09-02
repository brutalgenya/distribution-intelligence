import { BillingInterval, BillingPlanStatus, PlanSubscriptionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingProvider } from "../../modules/billing/billing-provider.types.js";
import { BillingCheckoutService } from "../../modules/billing/billing-checkout.service.js";
import type { BillingPlanRepository } from "../../modules/billing/billing-plan.repository.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { PlanSubscriptionRepository } from "../../modules/billing/plan-subscription.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "3ef1faa5-bf8b-4291-a8d0-0ef606a34f97",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("BillingCheckoutService", () => {
  it("creates a checkout session and records billing audit/outbox rows", async () => {
    const service = new BillingCheckoutService(
      {} as DbClient,
      {
        run: vi.fn(async (operation) => operation({} as never)),
      } as unknown as TransactionRunner,
      {
        findActiveByCode: vi.fn().mockResolvedValue({
          id: "plan-id",
          code: "starter",
          name: "Starter",
          version: 1,
          status: BillingPlanStatus.active,
          stripePriceId: "price_starter_monthly",
          interval: BillingInterval.monthly,
        }),
      } as unknown as BillingPlanRepository,
      {
        findByOrganization: vi.fn().mockResolvedValue({
          id: "subscription-id",
          organizationId: "organization-id",
          billingPlanId: "plan-id",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          status: PlanSubscriptionStatus.trialing,
          currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
          cancelAtPeriodEnd: false,
          lastStripeEventId: null,
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          billingPlan: {
            id: "plan-id",
            code: "starter",
            name: "Starter",
            version: 1,
            status: BillingPlanStatus.active,
            stripePriceId: "price_starter_monthly",
            interval: BillingInterval.monthly,
            maxUsers: 5,
            maxSkus: 250,
            maxForecastJobsPerPeriod: 100,
            maxAiRunsPerPeriod: 50,
            maxAutomationTier: "recommend",
            integrationsEnabled: [],
            supportTier: "standard",
            metadata: null,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        }),
        upsertByOrganization: vi.fn().mockResolvedValue(undefined),
      } as unknown as PlanSubscriptionRepository,
      {
        initializeTrialSubscriptionInTransaction: vi.fn(),
      } as unknown as BillingEntitlementService,
      {
        providerName: "mock",
        ensureCustomer: vi.fn().mockResolvedValue({ customerId: "cus_123" }),
        createCheckoutSession: vi.fn().mockResolvedValue({
          sessionId: "cs_123",
          url: "https://mock.stripe.local/checkout/cs_123",
          customerId: "cus_123",
        }),
      } as unknown as BillingProvider,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as OutboxEventRepository,
      {
        incrementCounter: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
      } as unknown as AppLogger,
      "http://localhost:4000/billing/success",
      "http://localhost:4000/billing/cancel",
      14,
    );

    const session = await service.createCheckoutSession(requestContext, {
      planCode: "starter",
    });

    expect(session.sessionId).toBe("cs_123");
    expect(session.customerId).toBe("cus_123");
  });
});
