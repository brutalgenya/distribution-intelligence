import { BillingPlanStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { toBillingPlanDto } from "./billing.mappers.js";
import type { BillingPlanDto } from "./billing.schemas.js";
import { BillingPlanRepository } from "./billing-plan.repository.js";

export class BillingPlanService {
  public constructor(
    private readonly db: DbClient,
    private readonly billingPlanRepository: BillingPlanRepository,
    private readonly authorizationService: AuthorizationService,
  ) {}

  public async listPlans(context: RequestContext): Promise<BillingPlanDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const plans = await this.billingPlanRepository.list(this.db, {
      status: BillingPlanStatus.active,
    });

    return plans.map(toBillingPlanDto);
  }

  public async getPlan(context: RequestContext, billingPlanId: string): Promise<BillingPlanDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const plan = await this.billingPlanRepository.findById(this.db, billingPlanId);
    if (!plan) {
      throw new NotFoundError("Billing plan was not found.");
    }

    return toBillingPlanDto(plan);
  }
}
