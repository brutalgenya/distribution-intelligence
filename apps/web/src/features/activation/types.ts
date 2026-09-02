import type { ApprovalTask } from "../decisions/types";
import type {
  ForecastJob,
  ForecastResult,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
} from "../data-ops/types";
import type { Decision } from "../decisions/types";
import type { MetricCardItem, MetricTone } from "../outcomes/types";
import type { SupportExecutionTask } from "../workflow/types";

export type {
  ApprovalTask,
  Decision,
  ForecastJob,
  ForecastResult,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  SupportExecutionTask,
};

export type BillingPlanStatus = "active" | "inactive" | "archived";
export type BillingInterval = "monthly" | "yearly";
export type PlanSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "incomplete"
  | "unpaid";
export type UsageMeterType =
  | "users"
  | "skus"
  | "forecast_jobs"
  | "ai_runs"
  | "executed_automation_actions";
export type AutomationTier = "observe" | "recommend" | "draft_only" | "auto_execute";

export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  version: number;
  status: BillingPlanStatus;
  stripePriceId: string | null;
  interval: BillingInterval;
  entitlements: {
    maxUsers: number;
    maxSkus: number;
    maxForecastJobsPerPeriod: number;
    maxAiRunsPerPeriod: number;
    maxAutomationTier: AutomationTier;
    integrationsEnabled: string[];
    supportTier: string | null;
  };
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSubscription {
  id: string;
  organizationId: string;
  billingPlanId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: PlanSubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastStripeEventId: string | null;
  createdAt: string;
  updatedAt: string;
  plan: BillingPlan;
}

export interface BillingUsageMeter {
  id: string;
  organizationId: string;
  meterType: UsageMeterType;
  usageValue: number;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  sourceType: string;
  sourceReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingEntitlements {
  organizationId: string;
  subscription: PlanSubscription | null;
  usageWindow: {
    start: string;
    end: string;
  };
  entitlements: {
    maxUsers: number;
    maxSkus: number;
    maxForecastJobsPerPeriod: number;
    maxAiRunsPerPeriod: number;
    maxAutomationTier: AutomationTier;
    integrationsEnabled: string[];
    supportTier: string | null;
  } | null;
  usage: {
    users: number;
    skus: number;
    forecastJobs: number;
    aiRuns: number;
    executedAutomationActions: number;
  };
  limits: {
    users: { limit: number; used: number; remaining: number; exceeded: boolean };
    skus: { limit: number; used: number; remaining: number; exceeded: boolean };
    forecastJobs: { limit: number; used: number; remaining: number; exceeded: boolean };
    aiRuns: { limit: number; used: number; remaining: number; exceeded: boolean };
  } | null;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
  customerId: string;
  planCode: string;
}

export interface PortalSession {
  sessionId: string;
  url: string;
}

export interface ActivationSummary {
  title: string;
  tone: MetricTone;
  helper: string;
  cards: MetricCardItem[];
}

export type ActivationStepStatus = "complete" | "attention" | "blocked";

export interface ActivationChecklistItem {
  id: string;
  title: string;
  status: ActivationStepStatus;
  evidence: string;
  helper: string;
  href: string;
  linkLabel: string;
}

export type NextBestActionKind =
  | "checkout"
  | "portal"
  | "process_sync"
  | "link"
  | "none";

export interface NextBestAction {
  kind: NextBestActionKind;
  title: string;
  description: string;
  buttonLabel: string | null;
  href: string | null;
  tone: MetricTone;
}

export interface CommercialReadiness {
  currentPlan: BillingPlan | null;
  subscription: PlanSubscription | null;
  entitlements: BillingEntitlements | null;
  usageMeters: BillingUsageMeter[];
  activePlans: BillingPlan[];
}

export interface DataReadiness {
  connections: IntegrationConnection[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
}

export interface IntelligenceReadiness {
  forecastJobs: ForecastJob[];
  latestForecastResults: ForecastResult[];
  decisions: Decision[];
  approvals: ApprovalTask[];
  executions: SupportExecutionTask[];
}

export interface ActivationActionFeedback {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
}
