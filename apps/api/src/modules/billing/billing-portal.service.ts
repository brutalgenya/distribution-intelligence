import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { billingAuditEventTypes } from "./billing.constants.js";
import type { BillingProvider } from "./billing-provider.types.js";
import type { CreatePortalSessionInput, PortalSessionDto } from "./billing.schemas.js";
import { PlanSubscriptionRepository } from "./plan-subscription.repository.js";

export class BillingPortalService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly planSubscriptionRepository: PlanSubscriptionRepository,
    private readonly billingProvider: BillingProvider,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly defaultReturnUrl: string,
  ) {}

  public async createPortalSession(
    context: RequestContext,
    input: CreatePortalSessionInput,
  ): Promise<PortalSessionDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.write");

    const subscription = await this.planSubscriptionRepository.findByOrganization(this.db, organizationId);
    if (!subscription?.stripeCustomerId) {
      throw new ConflictError("A Stripe customer is required before creating a billing portal session.");
    }

    const portalSession = await this.billingProvider.createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: input.returnUrl ?? this.defaultReturnUrl,
    });

    await this.transactionRunner.run(async (db) => {
      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: billingAuditEventTypes.portalSessionCreated,
        entityType: "PlanSubscription",
        entityId: subscription.id,
        payload: {
          billingPortalSessionId: portalSession.sessionId,
          stripeCustomerId: subscription.stripeCustomerId,
        },
        correlationId: context.correlationId,
      });
    });

    return {
      sessionId: portalSession.sessionId,
      url: portalSession.url,
    };
  }
}
