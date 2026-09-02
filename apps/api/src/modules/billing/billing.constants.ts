import {
  AutomationTier,
  BillingInterval,
  BillingPlanStatus,
  PlanSubscriptionStatus,
  UsageMeterType,
} from "@prisma/client";

export const DEFAULT_BILLING_PLAN_CODE = "starter";
export const DEFAULT_DEMO_BILLING_PLAN_CODE = "pro";

export const BILLING_PLAN_CODES = ["starter", "growth", "pro"] as const;

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export const BILLING_LIMITED_USAGE_METERS = [
  UsageMeterType.users,
  UsageMeterType.skus,
  UsageMeterType.forecast_jobs,
  UsageMeterType.ai_runs,
] as const;

export const BILLING_USAGE_METER_TYPES = [
  UsageMeterType.users,
  UsageMeterType.skus,
  UsageMeterType.forecast_jobs,
  UsageMeterType.ai_runs,
  UsageMeterType.executed_automation_actions,
] as const;

export const BILLING_SUBSCRIPTION_ACTIVE_STATUSES: ReadonlyArray<PlanSubscriptionStatus> = [
  PlanSubscriptionStatus.trialing,
  PlanSubscriptionStatus.active,
];

export const AUTOMATION_TIER_RANK: Record<AutomationTier, number> = {
  [AutomationTier.observe]: 0,
  [AutomationTier.recommend]: 1,
  [AutomationTier.draft_only]: 2,
  [AutomationTier.auto_execute]: 3,
};

export interface SeedBillingPlanDefinition {
  code: BillingPlanCode;
  name: string;
  version: number;
  status: BillingPlanStatus;
  stripePriceId: string;
  interval: BillingInterval;
  maxUsers: number;
  maxSkus: number;
  maxForecastJobsPerPeriod: number;
  maxAiRunsPerPeriod: number;
  maxAutomationTier: AutomationTier;
  integrationsEnabled: string[];
  supportTier: string | null;
}

export const DEFAULT_BILLING_PLAN_DEFINITIONS: ReadonlyArray<SeedBillingPlanDefinition> = [
  {
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
    maxAutomationTier: AutomationTier.recommend,
    integrationsEnabled: [],
    supportTier: "standard",
  },
  {
    code: "growth",
    name: "Growth",
    version: 1,
    status: BillingPlanStatus.active,
    stripePriceId: "price_growth_monthly",
    interval: BillingInterval.monthly,
    maxUsers: 25,
    maxSkus: 5_000,
    maxForecastJobsPerPeriod: 1_000,
    maxAiRunsPerPeriod: 500,
    maxAutomationTier: AutomationTier.draft_only,
    integrationsEnabled: ["billing_portal", "webhooks"],
    supportTier: "priority",
  },
  {
    code: "pro",
    name: "Pro",
    version: 1,
    status: BillingPlanStatus.active,
    stripePriceId: "price_pro_monthly",
    interval: BillingInterval.monthly,
    maxUsers: 250,
    maxSkus: 50_000,
    maxForecastJobsPerPeriod: 20_000,
    maxAiRunsPerPeriod: 10_000,
    maxAutomationTier: AutomationTier.auto_execute,
    integrationsEnabled: ["billing_portal", "webhooks", "advanced_support"],
    supportTier: "enterprise",
  },
];

export const billingAuditEventTypes = {
  checkoutSessionCreated: "billing.checkout.created",
  portalSessionCreated: "billing.portal.created",
  subscriptionCreated: "billing.subscription.created",
  subscriptionUpdated: "billing.subscription.updated",
  subscriptionCancelled: "billing.subscription.cancelled",
  stripeEventProcessed: "billing.stripe_event.processed",
  usageRecorded: "billing.usage.recorded",
} as const;

export const billingOutboxEventTypes = {
  checkoutSessionCreated: "billing.checkout.created.v1",
  subscriptionCreated: "billing.subscription.created.v1",
  subscriptionUpdated: "billing.subscription.updated.v1",
  subscriptionCancelled: "billing.subscription.cancelled.v1",
  usageRecorded: "billing.usage.recorded.v1",
} as const;
