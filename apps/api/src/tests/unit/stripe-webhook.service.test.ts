import {
  BillingInterval,
  BillingPlanStatus,
  PlanSubscriptionStatus,
  StripeEventProcessingStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingProvider } from "../../modules/billing/billing-provider.types.js";
import type { BillingPlanRepository } from "../../modules/billing/billing-plan.repository.js";
import type { PlanSubscriptionRepository } from "../../modules/billing/plan-subscription.repository.js";
import type { StripeEventLogRepository } from "../../modules/billing/stripe-event-log.repository.js";
import { StripeWebhookService } from "../../modules/billing/stripe-webhook.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

describe("StripeWebhookService", () => {
  it("deduplicates an already processed Stripe event", async () => {
    const service = new StripeWebhookService(
      {} as DbClient,
      { run: vi.fn() } as unknown as TransactionRunner,
      {} as BillingPlanRepository,
      {} as PlanSubscriptionRepository,
      {
        findByStripeEventId: vi.fn().mockResolvedValue({
          id: "event-log-id",
          stripeEventId: "evt_123",
          eventType: "customer.subscription.updated",
          organizationId: "organization-id",
          processingStatus: StripeEventProcessingStatus.processed,
          processedAt: new Date("2026-03-28T00:00:00.000Z"),
          errorMessage: null,
          payload: {},
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        }),
      } as unknown as StripeEventLogRepository,
      {
        providerName: "mock",
        verifyAndParseWebhook: vi.fn().mockResolvedValue({
          eventId: "evt_123",
          eventType: "customer.subscription.updated",
          organizationId: "organization-id",
          customerId: "cus_123",
          subscriptionId: "sub_123",
          priceId: "price_starter_monthly",
          subscriptionStatus: PlanSubscriptionStatus.active,
          currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
          cancelAtPeriodEnd: false,
          payload: {},
        }),
      } as unknown as BillingProvider,
      {} as AuthorizationService,
      {} as AuditEventRepository,
      {} as OutboxEventRepository,
      {
        incrementCounter: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
      } as unknown as AppLogger,
    );

    const result = await service.handleWebhook({
      rawBody: "{}",
      signature: null,
      correlationId: "corr-id",
    });

    expect(result.deduplicated).toBe(true);
    expect(result.processingStatus).toBe(StripeEventProcessingStatus.processed);
  });
});
