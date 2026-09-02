import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
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
import type { BillingProvider } from "./billing-provider.types.js";
import type { CheckoutSessionDto, CreateCheckoutSessionInput } from "./billing.schemas.js";
import { BillingPlanRepository } from "./billing-plan.repository.js";
import { BillingEntitlementService } from "./billing-entitlement.service.js";
import { PlanSubscriptionRepository } from "./plan-subscription.repository.js";

export class BillingCheckoutService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly billingPlanRepository: BillingPlanRepository,
    private readonly planSubscriptionRepository: PlanSubscriptionRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly billingProvider: BillingProvider,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
    private readonly defaultSuccessUrl: string,
    private readonly defaultCancelUrl: string,
    private readonly defaultTrialPeriodDays: number,
  ) {}

  public async createCheckoutSession(
    context: RequestContext,
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.write");

    const billingPlan = await this.billingPlanRepository.findActiveByCode(this.db, input.planCode);
    if (!billingPlan) {
      throw new NotFoundError("Billing plan was not found.");
    }

    if (!billingPlan.stripePriceId) {
      throw new ConflictError("The selected billing plan is not configured for Stripe checkout.");
    }

    const ensuredSubscription = await this.transactionRunner.run(async (db) => {
      const existingSubscription = await this.planSubscriptionRepository.findByOrganization(db, organizationId);
      if (existingSubscription) {
        return existingSubscription;
      }

      return this.billingEntitlementService.initializeTrialSubscriptionInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        trialPeriodDays: this.defaultTrialPeriodDays,
      });
    });

    const ensuredCustomer = await this.billingProvider.ensureCustomer({
      existingCustomerId: ensuredSubscription.stripeCustomerId,
      organizationId,
      organizationName: organizationId,
      contactEmail: context.user.email,
    });
    const checkoutSession = await this.billingProvider.createCheckoutSession({
      customerId: ensuredCustomer.customerId,
      priceId: billingPlan.stripePriceId,
      organizationId,
      planCode: billingPlan.code,
      successUrl: input.successUrl ?? this.defaultSuccessUrl,
      cancelUrl: input.cancelUrl ?? this.defaultCancelUrl,
    });

    await this.transactionRunner.run(async (db) => {
      await this.planSubscriptionRepository.upsertByOrganization(db, {
        organizationId,
        create: {
          organizationId,
          billingPlanId: ensuredSubscription.billingPlanId,
          status: ensuredSubscription.status,
          currentPeriodStart: ensuredSubscription.currentPeriodStart,
          currentPeriodEnd: ensuredSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: ensuredSubscription.cancelAtPeriodEnd,
          stripeCustomerId: ensuredCustomer.customerId,
          createdByUserId: context.user.id,
        },
        update: {
          stripeCustomerId: ensuredCustomer.customerId,
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: billingAuditEventTypes.checkoutSessionCreated,
        entityType: "PlanSubscription",
        entityId: ensuredSubscription.id,
        payload: {
          selectedBillingPlanId: billingPlan.id,
          selectedBillingPlanCode: billingPlan.code,
          stripeCustomerId: ensuredCustomer.customerId,
          checkoutSessionId: checkoutSession.sessionId,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: billingOutboxEventTypes.checkoutSessionCreated,
        aggregateType: "PlanSubscription",
        aggregateId: ensuredSubscription.id,
        payload: {
          organizationId,
          planSubscriptionId: ensuredSubscription.id,
          selectedBillingPlanId: billingPlan.id,
          selectedBillingPlanCode: billingPlan.code,
          stripeCustomerId: ensuredCustomer.customerId,
          checkoutSessionId: checkoutSession.sessionId,
        },
      });
    });

    this.telemetryService.incrementCounter("billing.checkout.created", 1, {
      organizationId,
      billingPlanCode: billingPlan.code,
      provider: this.billingProvider.providerName,
    });
    this.logger.info(
      "Billing checkout session created.",
      { checkoutSessionId: checkoutSession.sessionId, billingPlanCode: billingPlan.code },
      { module: "billing", operation: "createCheckoutSession", organizationId },
    );

    return {
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
      customerId: checkoutSession.customerId,
      planCode: billingPlan.code,
    };
  }
}
