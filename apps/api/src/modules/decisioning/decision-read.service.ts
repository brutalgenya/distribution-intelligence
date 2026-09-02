import type { DecisionStatus, DecisionType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { toDecisionDto } from "./decisioning.mappers.js";
import type { DecisionDto } from "./decisioning.schemas.js";
import { DecisionRepository } from "./decision.repository.js";

export class DecisionReadService {
  public constructor(
    private readonly db: DbClient,
    private readonly decisionRepository: DecisionRepository,
    private readonly authorizationService: AuthorizationService,
  ) {}

  public async listDecisions(
    context: RequestContext,
    filters: { decisionType?: DecisionType; status?: DecisionStatus; skuId?: string; locationId?: string },
  ): Promise<DecisionDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "decisioning.read");

    const decisions = await this.decisionRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.decisionType ? { decisionType: filters.decisionType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
    });

    return decisions.map(toDecisionDto);
  }

  public async getDecision(context: RequestContext, decisionId: string): Promise<DecisionDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "decisioning.read");

    const decision = await this.decisionRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: decisionId,
    });
    if (!decision) {
      throw new NotFoundError("Decision was not found.");
    }

    return toDecisionDto(decision);
  }

  public async listDecisionsBySku(
    context: RequestContext,
    skuId: string,
    filters: { decisionType?: DecisionType },
  ): Promise<DecisionDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "decisioning.read");

    const decisions = await this.decisionRepository.listBySku(this.db, {
      organizationId,
      skuId,
      ...(filters.decisionType ? { decisionType: filters.decisionType } : {}),
    });

    return decisions.map(toDecisionDto);
  }
}
