import {
  AutomationTier,
  BillingInterval,
  BillingPlanStatus,
  PlanSubscriptionStatus,
  StripeEventProcessingStatus,
  UsageMeterType,
} from "@prisma/client";
import { z } from "zod";

import { BILLING_PLAN_CODES } from "./billing.constants.js";

export const billingPlanCodeSchema = z.enum(BILLING_PLAN_CODES);

export const billingPlanIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const stripeEventLogIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createCheckoutSessionBodySchema = z.object({
  planCode: billingPlanCodeSchema,
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionBodySchema>;

export const createPortalSessionBodySchema = z.object({
  returnUrl: z.string().url().optional(),
});

export type CreatePortalSessionInput = z.infer<typeof createPortalSessionBodySchema>;

export const listStripeEventLogsQuerySchema = z.object({
  processingStatus: z.nativeEnum(StripeEventProcessingStatus).optional(),
});

export const listUsageQuerySchema = z.object({
  meterType: z.nativeEnum(UsageMeterType).optional(),
});

export interface BillingPlanDto {
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

export interface PlanSubscriptionDto {
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
  plan: BillingPlanDto;
}

export interface BillingUsageMeterDto {
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

export interface BillingEntitlementsDto {
  organizationId: string;
  subscription: PlanSubscriptionDto | null;
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

export interface CheckoutSessionDto {
  sessionId: string;
  url: string;
  customerId: string;
  planCode: string;
}

export interface PortalSessionDto {
  sessionId: string;
  url: string;
}

export interface StripeEventLogDto {
  id: string;
  stripeEventId: string;
  eventType: string;
  organizationId: string | null;
  processingStatus: StripeEventProcessingStatus;
  processedAt: string | null;
  errorMessage: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface StripeWebhookProcessingResultDto {
  stripeEventId: string;
  processingStatus: StripeEventProcessingStatus;
  deduplicated: boolean;
  organizationId: string | null;
}
