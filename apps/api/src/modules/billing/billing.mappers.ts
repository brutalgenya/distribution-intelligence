import type {
  BillingPlan,
  PlanSubscription,
  StripeEventLog,
  UsageMeter,
} from "@prisma/client";

import type {
  BillingEntitlementsDto,
  BillingPlanDto,
  BillingUsageMeterDto,
  PlanSubscriptionDto,
  StripeEventLogDto,
} from "./billing.schemas.js";
import type { PlanSubscriptionWithPlan } from "./plan-subscription.repository.js";
import type { ResolvedBillingState } from "./billing.types.js";

export const toBillingPlanDto = (plan: BillingPlan): BillingPlanDto => ({
  id: plan.id,
  code: plan.code,
  name: plan.name,
  version: plan.version,
  status: plan.status,
  stripePriceId: plan.stripePriceId,
  interval: plan.interval,
  entitlements: {
    maxUsers: plan.maxUsers,
    maxSkus: plan.maxSkus,
    maxForecastJobsPerPeriod: plan.maxForecastJobsPerPeriod,
    maxAiRunsPerPeriod: plan.maxAiRunsPerPeriod,
    maxAutomationTier: plan.maxAutomationTier,
    integrationsEnabled: Array.isArray(plan.integrationsEnabled)
      ? plan.integrationsEnabled.filter((value): value is string => typeof value === "string")
      : [],
    supportTier: plan.supportTier,
  },
  metadata: plan.metadata,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
});

export const toPlanSubscriptionDto = (
  subscription: PlanSubscriptionWithPlan | (PlanSubscription & { billingPlan: BillingPlan }),
): PlanSubscriptionDto => ({
  id: subscription.id,
  organizationId: subscription.organizationId,
  billingPlanId: subscription.billingPlanId,
  stripeCustomerId: subscription.stripeCustomerId,
  stripeSubscriptionId: subscription.stripeSubscriptionId,
  status: subscription.status,
  currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
  currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  lastStripeEventId: subscription.lastStripeEventId,
  createdAt: subscription.createdAt.toISOString(),
  updatedAt: subscription.updatedAt.toISOString(),
  plan: toBillingPlanDto(subscription.billingPlan),
});

export const toUsageMeterDto = (usageMeter: UsageMeter): BillingUsageMeterDto => ({
  id: usageMeter.id,
  organizationId: usageMeter.organizationId,
  meterType: usageMeter.meterType,
  usageValue: usageMeter.usageValue,
  measurementWindowStart: usageMeter.measurementWindowStart.toISOString(),
  measurementWindowEnd: usageMeter.measurementWindowEnd.toISOString(),
  sourceType: usageMeter.sourceType,
  sourceReference: usageMeter.sourceReference,
  createdAt: usageMeter.createdAt.toISOString(),
  updatedAt: usageMeter.updatedAt.toISOString(),
});

export const toStripeEventLogDto = (stripeEventLog: StripeEventLog): StripeEventLogDto => ({
  id: stripeEventLog.id,
  stripeEventId: stripeEventLog.stripeEventId,
  eventType: stripeEventLog.eventType,
  organizationId: stripeEventLog.organizationId,
  processingStatus: stripeEventLog.processingStatus,
  processedAt: stripeEventLog.processedAt?.toISOString() ?? null,
  errorMessage: stripeEventLog.errorMessage,
  payload: stripeEventLog.payload,
  createdAt: stripeEventLog.createdAt.toISOString(),
  updatedAt: stripeEventLog.updatedAt.toISOString(),
});

export const toBillingEntitlementsDto = (
  organizationId: string,
  state: ResolvedBillingState,
): BillingEntitlementsDto => ({
  organizationId,
  subscription: state.subscription ? toPlanSubscriptionDto(state.subscription) : null,
  usageWindow: {
    start: state.usageWindow.start.toISOString(),
    end: state.usageWindow.end.toISOString(),
  },
  entitlements: state.entitlements,
  usage: state.usage,
  limits: state.usageLimits,
});
