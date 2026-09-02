import {
  AutomationTier,
  PlanSubscriptionStatus,
  UsageMeterType,
  type BillingPlan,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { EntitlementLimitExceededError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  AUTOMATION_TIER_RANK,
  BILLING_LIMITED_USAGE_METERS,
  BILLING_SUBSCRIPTION_ACTIVE_STATUSES,
  DEFAULT_BILLING_PLAN_CODE,
  billingAuditEventTypes,
  billingOutboxEventTypes,
} from "./billing.constants.js";
import { toBillingEntitlementsDto, toPlanSubscriptionDto } from "./billing.mappers.js";
import type {
  BillingEntitlementsDto,
  PlanSubscriptionDto,
} from "./billing.schemas.js";
import { resolveUsageWindow } from "./billing-window.js";
import type {
  BillingLimitSummary,
  BillingUsageLimitSummary,
  EffectiveBillingEntitlements,
  ResolvedBillingState,
} from "./billing.types.js";
import { BillingPlanRepository } from "./billing-plan.repository.js";
import { type PlanSubscriptionWithPlan, PlanSubscriptionRepository } from "./plan-subscription.repository.js";
import { UsageMeterService } from "./usage-meter.service.js";

const toEffectiveEntitlements = (billingPlan: BillingPlan): EffectiveBillingEntitlements => ({
  maxUsers: billingPlan.maxUsers,
  maxSkus: billingPlan.maxSkus,
  maxForecastJobsPerPeriod: billingPlan.maxForecastJobsPerPeriod,
  maxAiRunsPerPeriod: billingPlan.maxAiRunsPerPeriod,
  maxAutomationTier: billingPlan.maxAutomationTier,
  integrationsEnabled: Array.isArray(billingPlan.integrationsEnabled)
    ? billingPlan.integrationsEnabled.filter((value): value is string => typeof value === "string")
    : [],
  supportTier: billingPlan.supportTier,
});

const buildLimitSummary = (limit: number, used: number): BillingLimitSummary => ({
  limit,
  used,
  remaining: Math.max(limit - used, 0),
  exceeded: used >= limit,
});

const buildUsageLimitSummary = (
  entitlements: EffectiveBillingEntitlements,
  usage: ResolvedBillingState["usage"],
): BillingUsageLimitSummary => ({
  users: buildLimitSummary(entitlements.maxUsers, usage.users),
  skus: buildLimitSummary(entitlements.maxSkus, usage.skus),
  forecastJobs: buildLimitSummary(entitlements.maxForecastJobsPerPeriod, usage.forecastJobs),
  aiRuns: buildLimitSummary(entitlements.maxAiRunsPerPeriod, usage.aiRuns),
});

export class BillingEntitlementService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly billingPlanRepository: BillingPlanRepository,
    private readonly planSubscriptionRepository: PlanSubscriptionRepository,
    private readonly usageMeterService: UsageMeterService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async getCurrentSubscription(context: RequestContext): Promise<PlanSubscriptionDto | null> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const subscription = await this.planSubscriptionRepository.findByOrganization(this.db, organizationId);
    return subscription ? toPlanSubscriptionDto(subscription) : null;
  }

  public async getEffectiveEntitlements(context: RequestContext): Promise<BillingEntitlementsDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const state = await this.resolveBillingState(this.db, organizationId);
    return toBillingEntitlementsDto(organizationId, state);
  }

  public async resolveBillingState(
    db: DbClient,
    organizationId: string,
    now = new Date(),
  ): Promise<ResolvedBillingState> {
    const subscription = await this.planSubscriptionRepository.findByOrganization(db, organizationId);
    const plan = subscription?.billingPlan ?? null;
    const usageWindow = resolveUsageWindow(subscription, now);
    const usage = await this.usageMeterService.computeUsageSummary(db, organizationId, usageWindow);
    const entitlements =
      subscription && BILLING_SUBSCRIPTION_ACTIVE_STATUSES.includes(subscription.status)
        ? toEffectiveEntitlements(subscription.billingPlan)
        : null;

    return {
      subscription,
      plan,
      entitlements,
      usageWindow,
      usage,
      usageLimits: entitlements ? buildUsageLimitSummary(entitlements, usage) : null,
    };
  }

  public async initializeTrialSubscriptionInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      trialPeriodDays: number;
      billingPlanCode?: string;
    },
  ): Promise<PlanSubscriptionWithPlan> {
    const existingSubscription = await this.planSubscriptionRepository.findByOrganization(db, input.organizationId);
    if (existingSubscription) {
      return existingSubscription;
    }

    const billingPlan = await this.billingPlanRepository.findActiveByCode(
      db,
      input.billingPlanCode ?? DEFAULT_BILLING_PLAN_CODE,
    );
    if (!billingPlan) {
      throw new NotFoundError("A default active billing plan is required before organizations can be provisioned.");
    }

    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + input.trialPeriodDays * 24 * 60 * 60 * 1000);

    const subscription = await this.planSubscriptionRepository.create(db, {
      organizationId: input.organizationId,
      billingPlanId: billingPlan.id,
      status: PlanSubscriptionStatus.trialing,
      currentPeriodStart: now,
      currentPeriodEnd,
      createdByUserId: input.actorUserId,
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: billingAuditEventTypes.subscriptionCreated,
      entityType: "PlanSubscription",
      entityId: subscription.id,
      payload: {
        billingPlanId: billingPlan.id,
        billingPlanCode: billingPlan.code,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: billingOutboxEventTypes.subscriptionCreated,
      aggregateType: "PlanSubscription",
      aggregateId: subscription.id,
      payload: {
        organizationId: input.organizationId,
        planSubscriptionId: subscription.id,
        billingPlanId: billingPlan.id,
        billingPlanCode: billingPlan.code,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      },
    });

    return subscription;
  }

  public async ensureNewMembershipAllowedInTransaction(
    db: DbClient,
    input: { organizationId: string },
  ): Promise<void> {
    await this.assertMeterCapacityInTransaction(db, input.organizationId, UsageMeterType.users, 1);
  }

  public async ensureNewSkuAllowedInTransaction(
    db: DbClient,
    input: { organizationId: string },
  ): Promise<void> {
    await this.assertMeterCapacityInTransaction(db, input.organizationId, UsageMeterType.skus, 1);
  }

  public async ensureForecastJobAllowedInTransaction(
    db: DbClient,
    input: { organizationId: string },
  ): Promise<void> {
    await this.assertMeterCapacityInTransaction(db, input.organizationId, UsageMeterType.forecast_jobs, 1);
  }

  public async ensureAiRunAllowedInTransaction(
    db: DbClient,
    input: { organizationId: string },
  ): Promise<void> {
    await this.assertMeterCapacityInTransaction(db, input.organizationId, UsageMeterType.ai_runs, 1);
  }

  public async ensureAutomationTierAllowedInTransaction(
    db: DbClient,
    input: { organizationId: string; requestedAutomationTier: AutomationTier },
  ): Promise<void> {
    const state = await this.resolveBillingState(db, input.organizationId);
    if (!state.entitlements) {
      throw new EntitlementLimitExceededError("An active or trialing subscription is required to use automation.");
    }

    const allowedRank = AUTOMATION_TIER_RANK[state.entitlements.maxAutomationTier];
    const requestedRank = AUTOMATION_TIER_RANK[input.requestedAutomationTier];
    if (requestedRank > allowedRank) {
      throw new EntitlementLimitExceededError("The current billing plan does not allow this automation tier.", {
        maxAutomationTier: state.entitlements.maxAutomationTier,
        requestedAutomationTier: input.requestedAutomationTier,
      });
    }
  }

  public async recordCurrentUsageInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      meterTypes: readonly UsageMeterType[];
      sourceType: string;
      sourceReference?: string | null;
    },
  ): Promise<void> {
    const state = await this.resolveBillingState(db, input.organizationId);
    await this.usageMeterService.recordUsageMetersInTransaction(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      usageWindow: state.usageWindow,
      meterTypes: input.meterTypes,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference ?? null,
    });
  }

  private async assertMeterCapacityInTransaction(
    db: DbClient,
    organizationId: string,
    meterType: (typeof BILLING_LIMITED_USAGE_METERS)[number],
    incrementBy: number,
  ): Promise<void> {
    const state = await this.resolveBillingState(db, organizationId);
    if (!state.entitlements || !state.usageLimits) {
      throw new EntitlementLimitExceededError("An active or trialing subscription is required to perform this action.");
    }

    switch (meterType) {
      case UsageMeterType.users: {
        if (state.usage.users + incrementBy > state.entitlements.maxUsers) {
          throw new EntitlementLimitExceededError("The current billing plan user limit has been exceeded.", {
            limit: state.entitlements.maxUsers,
            used: state.usage.users,
            requestedIncrement: incrementBy,
          });
        }

        return;
      }
      case UsageMeterType.skus: {
        if (state.usage.skus + incrementBy > state.entitlements.maxSkus) {
          throw new EntitlementLimitExceededError("The current billing plan SKU limit has been exceeded.", {
            limit: state.entitlements.maxSkus,
            used: state.usage.skus,
            requestedIncrement: incrementBy,
          });
        }

        return;
      }
      case UsageMeterType.forecast_jobs: {
        if (state.usage.forecastJobs + incrementBy > state.entitlements.maxForecastJobsPerPeriod) {
          throw new EntitlementLimitExceededError(
            "The current billing plan forecast job limit has been exceeded for the current period.",
            {
              limit: state.entitlements.maxForecastJobsPerPeriod,
              used: state.usage.forecastJobs,
              requestedIncrement: incrementBy,
            },
          );
        }

        return;
      }
      case UsageMeterType.ai_runs: {
        if (state.usage.aiRuns + incrementBy > state.entitlements.maxAiRunsPerPeriod) {
          throw new EntitlementLimitExceededError(
            "The current billing plan AI run limit has been exceeded for the current period.",
            {
              limit: state.entitlements.maxAiRunsPerPeriod,
              used: state.usage.aiRuns,
              requestedIncrement: incrementBy,
            },
          );
        }
      }
    }
  }
}
