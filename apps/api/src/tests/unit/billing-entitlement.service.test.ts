import { AutomationTier, BillingInterval, BillingPlanStatus, PlanSubscriptionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { BillingPlanRepository } from "../../modules/billing/billing-plan.repository.js";
import type { PlanSubscriptionRepository } from "../../modules/billing/plan-subscription.repository.js";
import type { UsageMeterService } from "../../modules/billing/usage-meter.service.js";
import { EntitlementLimitExceededError } from "../../shared/errors.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const activeSubscription = {
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
    maxForecastJobsPerPeriod: 1,
    maxAiRunsPerPeriod: 1,
    maxAutomationTier: AutomationTier.recommend,
    integrationsEnabled: [],
    supportTier: "standard",
    metadata: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  },
};

describe("BillingEntitlementService", () => {
  it("resolves current usage and entitlements for an active subscription", async () => {
    const service = new BillingEntitlementService(
      {} as DbClient,
      { run: vi.fn() } as unknown as TransactionRunner,
      {} as BillingPlanRepository,
      {
        findByOrganization: vi.fn().mockResolvedValue(activeSubscription),
      } as unknown as PlanSubscriptionRepository,
      {
        computeUsageSummary: vi.fn().mockResolvedValue({
          users: 2,
          skus: 12,
          forecastJobs: 1,
          aiRuns: 0,
          executedAutomationActions: 0,
        }),
      } as unknown as UsageMeterService,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {} as never,
    );

    const state = await service.resolveBillingState({} as DbClient, "organization-id");

    expect(state.entitlements?.maxForecastJobsPerPeriod).toBe(1);
    expect(state.usage.users).toBe(2);
  });

  it("rejects forecast job creation when the plan limit is exceeded", async () => {
    const service = new BillingEntitlementService(
      {} as DbClient,
      { run: vi.fn() } as unknown as TransactionRunner,
      {} as BillingPlanRepository,
      {
        findByOrganization: vi.fn().mockResolvedValue(activeSubscription),
      } as unknown as PlanSubscriptionRepository,
      {
        computeUsageSummary: vi.fn().mockResolvedValue({
          users: 2,
          skus: 12,
          forecastJobs: 1,
          aiRuns: 0,
          executedAutomationActions: 0,
        }),
      } as unknown as UsageMeterService,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.ensureForecastJobAllowedInTransaction({} as DbClient, {
        organizationId: "organization-id",
      }),
    ).rejects.toBeInstanceOf(EntitlementLimitExceededError);
  });
});
