import type { DbClient } from "../../infrastructure/db/types.js";
import { ForbiddenError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import {
  OrganizationMembershipRepository,
  type MembershipWithUserAndRole,
} from "../tenancy/membership.repository.js";
import { organizationPermissionMatrix, type OrganizationAction } from "./permissions.js";

export class AuthorizationService {
  public constructor(private readonly membershipRepository: OrganizationMembershipRepository) {}

  public async requireOrganizationPermission(
    db: DbClient,
    context: RequestContext,
    organizationId: string,
    action: OrganizationAction,
  ): Promise<MembershipWithUserAndRole> {
    if (context.activeOrganizationId !== null && context.activeOrganizationId !== organizationId) {
      throw new ForbiddenError("Active organization context does not match the requested organization.");
    }

    const membership = await this.membershipRepository.findByUserAndOrganization(db, {
      organizationId,
      userId: context.user.id,
    });

    if (!membership) {
      throw new ForbiddenError("You do not have access to this organization.");
    }

    const allowedActions = organizationPermissionMatrix[membership.role.code];
    if (!allowedActions.has(action)) {
      throw new ForbiddenError(`Role ${membership.role.code} is not allowed to perform ${action}.`);
    }

    return membership;
  }
}
