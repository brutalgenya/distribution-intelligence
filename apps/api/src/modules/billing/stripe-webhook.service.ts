import { Prisma, PlanSubscriptionStatus, StripeEventProcessingStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  billingAuditEventTypes,
  billingOutboxEventTypes,
} from "./billing.constants.js";
import { toStripeEventLogDto } from "./billing.mappers.js";
import type {
  StripeEventLogDto,
  StripeWebhookProcessingResultDto,
} from "./billing.schemas.js";
import type { BillingProvider, BillingWebhookEvent } from "./billing-provider.types.js";
import { BillingPlanRepository } from "./billing-plan.repository.js";
import { type PlanSubscriptionWithPlan, PlanSubscriptionRepository } from "./plan-subscription.repository.js";
import { StripeEventLogRepository } from "./stripe-event-log.repository.js";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Stripe webhook processing failed.";
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export class StripeWebhookService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly billingPlanRepository: BillingPlanRepository,
    private readonly planSubscriptionRepository: PlanSubscriptionRepository,
    private readonly stripeEventLogRepository: StripeEventLogRepository,
    private readonly billingProvider: BillingProvider,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async handleWebhook(input: {
    rawBody: string;
    signature?: string | null;
    correlationId: string;
  }): Promise<StripeWebhookProcessingResultDto> {
    const webhookEvent = await this.billingProvider.verifyAndParseWebhook({
      rawBody: input.rawBody,
      signature: input.signature ?? null,
    });
    const existingLog = await this.stripeEventLogRepository.findByStripeEventId(this.db, webhookEvent.eventId);
    if (existingLog?.processingStatus === StripeEventProcessingStatus.processed) {
      return {
        stripeEventId: existingLog.stripeEventId,
        processingStatus: existingLog.processingStatus,
        deduplicated: true,
        organizationId: existingLog.organizationId,
      };
    }

    const eventLog =
      existingLog ??
      (await this.stripeEventLogRepository.create(this.db, {
        stripeEventId: webhookEvent.eventId,
        eventType: webhookEvent.eventType,
        ...(webhookEvent.organizationId ? { organizationId: webhookEvent.organizationId } : {}),
        processingStatus: StripeEventProcessingStatus.pending,
        payload: toJsonValue(webhookEvent.payload),
      }));

    try {
      const processedLog = await this.transactionRunner.run(async (db) => {
        const result = await this.applyWebhookEvent(db, webhookEvent);
        const processedAt = new Date();

        if (result.subscription) {
          await this.auditEventRepository.create(db, {
            organizationId: result.subscription.organizationId,
            actorUserId: null,
            eventType: result.auditEventType,
            entityType: "PlanSubscription",
            entityId: result.subscription.id,
            payload: {
              stripeEventId: webhookEvent.eventId,
              stripeEventType: webhookEvent.eventType,
              status: result.subscription.status,
              stripeSubscriptionId: result.subscription.stripeSubscriptionId,
              stripeCustomerId: result.subscription.stripeCustomerId,
            },
            correlationId: input.correlationId,
          });

          await this.outboxEventRepository.create(db, {
            organizationId: result.subscription.organizationId,
            eventType: result.outboxEventType,
            aggregateType: "PlanSubscription",
            aggregateId: result.subscription.id,
            payload: {
              organizationId: result.subscription.organizationId,
              planSubscriptionId: result.subscription.id,
              stripeEventId: webhookEvent.eventId,
              stripeEventType: webhookEvent.eventType,
              status: result.subscription.status,
              stripeSubscriptionId: result.subscription.stripeSubscriptionId,
              stripeCustomerId: result.subscription.stripeCustomerId,
            },
          });
        }

        await this.auditEventRepository.create(db, {
          organizationId: result.organizationId,
          actorUserId: null,
          eventType: billingAuditEventTypes.stripeEventProcessed,
          entityType: "StripeEventLog",
          entityId: eventLog.id,
          payload: {
            stripeEventId: webhookEvent.eventId,
            stripeEventType: webhookEvent.eventType,
            organizationId: result.organizationId,
          },
          correlationId: input.correlationId,
        });

        return this.stripeEventLogRepository.updateById(db, {
          id: eventLog.id,
          data: {
            organizationId: result.organizationId,
            processingStatus: StripeEventProcessingStatus.processed,
            processedAt,
            errorMessage: null,
          },
        });
      });

      this.telemetryService.incrementCounter("billing.webhook.processed", 1, {
        provider: this.billingProvider.providerName,
        eventType: webhookEvent.eventType,
      });
      this.logger.info(
        "Billing webhook processed.",
        { stripeEventId: webhookEvent.eventId, eventType: webhookEvent.eventType },
        { module: "billing", operation: "handleWebhook", organizationId: processedLog.organizationId },
      );

      return {
        stripeEventId: processedLog.stripeEventId,
        processingStatus: processedLog.processingStatus,
        deduplicated: false,
        organizationId: processedLog.organizationId,
      };
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      await this.transactionRunner.run(async (db) => {
        await this.stripeEventLogRepository.updateById(db, {
          id: eventLog.id,
          data: {
            organizationId: webhookEvent.organizationId ?? eventLog.organizationId,
            processingStatus: StripeEventProcessingStatus.failed,
            errorMessage,
          },
        });
      });

      this.telemetryService.incrementCounter("billing.webhook.failed", 1, {
        provider: this.billingProvider.providerName,
        eventType: webhookEvent.eventType,
      });

      throw error;
    }
  }

  public async listStripeEventLogs(
    context: RequestContext,
    filters: { processingStatus?: StripeEventProcessingStatus },
  ): Promise<StripeEventLogDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const logs = await this.stripeEventLogRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.processingStatus ? { processingStatus: filters.processingStatus } : {}),
    });

    return logs.map(toStripeEventLogDto);
  }

  public async getStripeEventLog(context: RequestContext, stripeEventLogId: string): Promise<StripeEventLogDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const log = await this.stripeEventLogRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: stripeEventLogId,
    });
    if (!log) {
      throw new NotFoundError("Stripe event log was not found.");
    }

    return toStripeEventLogDto(log);
  }

  private async applyWebhookEvent(
    db: DbClient,
    webhookEvent: BillingWebhookEvent,
  ): Promise<{
    organizationId: string | null;
    subscription: PlanSubscriptionWithPlan | null;
    auditEventType: string;
    outboxEventType: string;
  }> {
    switch (webhookEvent.eventType) {
      case "checkout.session.completed":
        return this.applyCheckoutCompletedEvent(db, webhookEvent);
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_failed":
      case "invoice.paid":
        return this.applySubscriptionLifecycleEvent(db, webhookEvent);
    }
  }

  private async applyCheckoutCompletedEvent(
    db: DbClient,
    webhookEvent: BillingWebhookEvent,
  ): Promise<{
    organizationId: string | null;
    subscription: PlanSubscriptionWithPlan | null;
    auditEventType: string;
    outboxEventType: string;
  }> {
    if (!webhookEvent.organizationId) {
      throw new NotFoundError("Stripe checkout session did not include an organization reference.");
    }

    const existingSubscription = await this.planSubscriptionRepository.findByOrganization(
      db,
      webhookEvent.organizationId,
    );
    if (!existingSubscription) {
      throw new NotFoundError("No subscription record exists for the organization referenced by the Stripe event.");
    }

    const updatedSubscription = await this.planSubscriptionRepository.updateById(db, {
      id: existingSubscription.id,
      data: {
        stripeCustomerId: webhookEvent.customerId,
        stripeSubscriptionId: webhookEvent.subscriptionId,
        lastStripeEventId: webhookEvent.eventId,
      },
    });

    return {
      organizationId: webhookEvent.organizationId,
      subscription: updatedSubscription,
      auditEventType: billingAuditEventTypes.subscriptionUpdated,
      outboxEventType: billingOutboxEventTypes.subscriptionUpdated,
    };
  }

  private async applySubscriptionLifecycleEvent(
    db: DbClient,
    webhookEvent: BillingWebhookEvent,
  ): Promise<{
    organizationId: string | null;
    subscription: PlanSubscriptionWithPlan | null;
    auditEventType: string;
    outboxEventType: string;
  }> {
    const existingSubscription = await this.findSubscriptionForWebhook(db, webhookEvent);
    const organizationId = webhookEvent.organizationId ?? existingSubscription?.organizationId ?? null;
    if (!organizationId) {
      throw new NotFoundError("The Stripe event could not be matched to an organization.");
    }

    const resolvedPlan =
      webhookEvent.priceId !== null
        ? await this.billingPlanRepository.findByStripePriceId(db, webhookEvent.priceId)
        : existingSubscription?.billingPlan ?? null;
    if (!resolvedPlan) {
      throw new NotFoundError("The Stripe event could not be matched to a billing plan.");
    }

    const nextStatus =
      webhookEvent.eventType === "invoice.payment_failed"
        ? PlanSubscriptionStatus.past_due
        : webhookEvent.eventType === "invoice.paid"
          ? PlanSubscriptionStatus.active
          : webhookEvent.subscriptionStatus ?? existingSubscription?.status ?? PlanSubscriptionStatus.incomplete;

    const persistedSubscription = await this.planSubscriptionRepository.upsertByOrganization(db, {
      organizationId,
      create: {
        organizationId,
        billingPlanId: resolvedPlan.id,
        ...(webhookEvent.customerId ? { stripeCustomerId: webhookEvent.customerId } : {}),
        ...(webhookEvent.subscriptionId ? { stripeSubscriptionId: webhookEvent.subscriptionId } : {}),
        status: nextStatus,
        ...(webhookEvent.currentPeriodStart ? { currentPeriodStart: webhookEvent.currentPeriodStart } : {}),
        ...(webhookEvent.currentPeriodEnd ? { currentPeriodEnd: webhookEvent.currentPeriodEnd } : {}),
        cancelAtPeriodEnd: webhookEvent.cancelAtPeriodEnd ?? false,
        lastStripeEventId: webhookEvent.eventId,
      },
      update: {
        billingPlanId: resolvedPlan.id,
        stripeCustomerId: webhookEvent.customerId ?? existingSubscription?.stripeCustomerId ?? null,
        stripeSubscriptionId: webhookEvent.subscriptionId ?? existingSubscription?.stripeSubscriptionId ?? null,
        status: nextStatus,
        currentPeriodStart: webhookEvent.currentPeriodStart ?? existingSubscription?.currentPeriodStart ?? null,
        currentPeriodEnd: webhookEvent.currentPeriodEnd ?? existingSubscription?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: webhookEvent.cancelAtPeriodEnd ?? existingSubscription?.cancelAtPeriodEnd ?? false,
        lastStripeEventId: webhookEvent.eventId,
      },
    });

    const eventTypes =
      nextStatus === PlanSubscriptionStatus.cancelled
        ? {
            audit: billingAuditEventTypes.subscriptionCancelled,
            outbox: billingOutboxEventTypes.subscriptionCancelled,
          }
        : {
            audit: existingSubscription ? billingAuditEventTypes.subscriptionUpdated : billingAuditEventTypes.subscriptionCreated,
            outbox: existingSubscription
              ? billingOutboxEventTypes.subscriptionUpdated
              : billingOutboxEventTypes.subscriptionCreated,
          };

    return {
      organizationId,
      subscription: persistedSubscription,
      auditEventType: eventTypes.audit,
      outboxEventType: eventTypes.outbox,
    };
  }

  private async findSubscriptionForWebhook(
    db: DbClient,
    webhookEvent: BillingWebhookEvent,
  ): Promise<PlanSubscriptionWithPlan | null> {
    if (webhookEvent.subscriptionId) {
      const subscription = await this.planSubscriptionRepository.findByStripeSubscriptionId(
        db,
        webhookEvent.subscriptionId,
      );
      if (subscription) {
        return subscription;
      }
    }

    if (webhookEvent.customerId) {
      const subscription = await this.planSubscriptionRepository.findByStripeCustomerId(db, webhookEvent.customerId);
      if (subscription) {
        return subscription;
      }
    }

    if (webhookEvent.organizationId) {
      return this.planSubscriptionRepository.findByOrganization(db, webhookEvent.organizationId);
    }

    return null;
  }
}
