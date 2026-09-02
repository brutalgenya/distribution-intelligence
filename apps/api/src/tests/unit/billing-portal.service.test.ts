import { BillingInterval, BillingPlanStatus, PlanSubscriptionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingProvider } from "../../modules/billing/billing-provider.types.js";
import { BillingPortalService } from "../../modules/billing/billing-portal.service.js";
import type { PlanSubscriptionRepository } from "../../modules/billing/plan-subscription.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "bb86ae54-d00d-4310-b0c7-317925143c2e",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("BillingPortalService", () => {
  it("creates a billing portal session for an org with a Stripe customer", async () => {
    const service = new BillingPortalService(
      {} as DbClient,
      {
        run: vi.fn(async (operation) => operation({} as never)),
      } as unknown as TransactionRunner,
      {
        findByOrganization: vi.fn().mockResolvedValue({
          id: "subscription-id",
          organizationId: "organization-id",
          billingPlanId: "plan-id",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          status: PlanSubscriptionStatus.active,
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
      } as unknown as PlanSubscriptionRepository,
      {
        providerName: "mock",
        createPortalSession: vi.fn().mockResolvedValue({
          sessionId: "bps_123",
          url: "https://mock.stripe.local/portal/bps_123",
        }),
      } as unknown as BillingProvider,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuditEventRepository,
      "http://localhost:4000/settings/billing",
    );

    const session = await service.createPortalSession(requestContext, {});

    expect(session.sessionId).toBe("bps_123");
  });
});
