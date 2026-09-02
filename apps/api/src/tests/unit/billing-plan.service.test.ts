import { BillingInterval, BillingPlanStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { BillingPlanService } from "../../modules/billing/billing-plan.service.js";
import type { BillingPlanRepository } from "../../modules/billing/billing-plan.repository.js";
import type { RequestContext } from "../../shared/request-context.js";

const requestContext: RequestContext = {
  correlationId: "04f6bde8-20fd-4d7a-bcf8-ae9298c4c19a",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("BillingPlanService", () => {
  it("lists active billing plans for an authorized tenant", async () => {
    const billingPlanRepository = {
      list: vi.fn().mockResolvedValue([
        {
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
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      ]),
    } as unknown as BillingPlanRepository;

    const service = new BillingPlanService(
      {} as DbClient,
      billingPlanRepository,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
    );

    const plans = await service.listPlans(requestContext);

    expect(plans).toHaveLength(1);
    expect(plans[0]?.code).toBe("starter");
  });
});
