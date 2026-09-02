import { Prisma, RoleCode, UsageMeterType, type Entitlement } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { DEFAULT_ORGANIZATION_ENTITLEMENTS } from "../../shared/defaults.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { EntitlementRepository } from "./entitlement.repository.js";
import { OrganizationMembershipRepository, type MembershipWithUserAndRole } from "./membership.repository.js";
import { OrganizationRepository } from "./organization.repository.js";
import { RoleRepository } from "./role.repository.js";
import type {
  CreateOrganizationInput,
  CreateOrganizationResultDto,
  EntitlementDto,
  MembershipDto,
  OrganizationDto,
} from "./tenancy.schemas.js";

const toOrganizationDto = (organization: {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}): OrganizationDto => ({
  id: organization.id,
  name: organization.name,
  slug: organization.slug,
  createdAt: organization.createdAt.toISOString(),
});

const toMembershipDto = (membership: MembershipWithUserAndRole): MembershipDto => ({
  id: membership.id,
  organizationId: membership.organizationId,
  createdAt: membership.createdAt.toISOString(),
  user: {
    id: membership.user.id,
    email: membership.user.email,
    displayName: membership.user.displayName,
  },
  role: membership.role.code,
});

const toEntitlementDto = (entitlement: Entitlement): EntitlementDto => ({
  id: entitlement.id,
  key: entitlement.key,
  value: entitlement.value,
  createdAt: entitlement.createdAt.toISOString(),
});

export class OrganizationService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly organizationRepository: OrganizationRepository,
    private readonly roleRepository: RoleRepository,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly entitlementRepository: EntitlementRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly defaultTrialPeriodDays: number,
  ) {}

  public async createOrganization(
    context: RequestContext,
    input: CreateOrganizationInput,
  ): Promise<CreateOrganizationResultDto> {
    try {
      return await this.transactionRunner.run(async (db) => {
        const ownerRole = await this.roleRepository.findByCode(db, RoleCode.owner);
        if (!ownerRole) {
          throw new NotFoundError("Owner role is not configured.");
        }

        const organization = await this.organizationRepository.create(db, {
          name: input.name,
          slug: input.slug,
        });

        const ownerMembership = await this.membershipRepository.create(db, {
          organizationId: organization.id,
          userId: context.user.id,
          roleId: ownerRole.id,
        });

        await this.entitlementRepository.createMany(db, organization.id, DEFAULT_ORGANIZATION_ENTITLEMENTS);
        await this.billingEntitlementService.initializeTrialSubscriptionInTransaction(db, {
          organizationId: organization.id,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          trialPeriodDays: this.defaultTrialPeriodDays,
        });
        await this.billingEntitlementService.recordCurrentUsageInTransaction(db, {
          organizationId: organization.id,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          meterTypes: [UsageMeterType.users],
          sourceType: "organization_created",
          sourceReference: organization.id,
        });

        await this.auditEventRepository.create(db, {
          organizationId: organization.id,
          actorUserId: context.user.id,
          eventType: "organization.created",
          entityType: "Organization",
          entityId: organization.id,
          payload: {
            name: organization.name,
            slug: organization.slug,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId: organization.id,
          eventType: "organization.created",
          aggregateType: "Organization",
          aggregateId: organization.id,
          payload: {
            organizationId: organization.id,
            ownerUserId: context.user.id,
          },
        });

        return {
          organization: toOrganizationDto(organization),
          ownerMembership: toMembershipDto(ownerMembership),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Organization slug already exists.");
      }

      throw error;
    }
  }

  public async listMemberships(context: RequestContext, organizationId: string): Promise<MembershipDto[]> {
    await this.authorizationService.requireOrganizationPermission(
      this.db,
      context,
      organizationId,
      "organization.memberships.read",
    );

    const memberships = await this.membershipRepository.listByOrganization(this.db, organizationId);
    return memberships.map(toMembershipDto);
  }

  public async listEntitlements(context: RequestContext, organizationId: string): Promise<EntitlementDto[]> {
    await this.authorizationService.requireOrganizationPermission(
      this.db,
      context,
      organizationId,
      "organization.entitlements.read",
    );

    const entitlements = await this.entitlementRepository.listByOrganization(this.db, organizationId);
    return entitlements.map(toEntitlementDto);
  }
}
