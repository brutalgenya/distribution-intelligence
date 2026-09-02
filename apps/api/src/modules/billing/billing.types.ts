import type {
  AutomationTier,
  BillingPlan,
  UsageMeterType,
} from "@prisma/client";
import type { PlanSubscriptionWithPlan } from "./plan-subscription.repository.js";

export interface UsageWindow {
  start: Date;
  end: Date;
}

export interface EffectiveBillingEntitlements {
  maxUsers: number;
  maxSkus: number;
  maxForecastJobsPerPeriod: number;
  maxAiRunsPerPeriod: number;
  maxAutomationTier: AutomationTier;
  integrationsEnabled: string[];
  supportTier: string | null;
}

export interface BillingUsageSummary {
  users: number;
  skus: number;
  forecastJobs: number;
  aiRuns: number;
  executedAutomationActions: number;
}

export interface BillingLimitSummary {
  limit: number;
  used: number;
  remaining: number;
  exceeded: boolean;
}

export interface BillingUsageLimitSummary {
  users: BillingLimitSummary;
  skus: BillingLimitSummary;
  forecastJobs: BillingLimitSummary;
  aiRuns: BillingLimitSummary;
}

export interface ResolvedBillingState {
  subscription: PlanSubscriptionWithPlan | null;
  plan: BillingPlan | null;
  entitlements: EffectiveBillingEntitlements | null;
  usageWindow: UsageWindow;
  usage: BillingUsageSummary;
  usageLimits: BillingUsageLimitSummary | null;
}

export interface UsageMeterSnapshot {
  meterType: UsageMeterType;
  usageValue: number;
  measurementWindowStart: Date;
  measurementWindowEnd: Date;
}
