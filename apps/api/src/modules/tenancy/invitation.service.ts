import { InvitationStatus, Prisma, RoleCode, UsageMeterType } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import { normalizeEmail } from "../../shared/strings.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { UserRepository } from "../identity/user.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { OrganizationInvitationRepository } from "./invitation.repository.js";
import { OrganizationMembershipRepository } from "./membership.repository.js";
import { RoleRepository } from "./role.repository.js";
import type {
  AcceptInvitationInput,
  AcceptInvitationResultDto,
  InvitationDto,
  InviteMemberInput,
  MembershipDto,
  OrganizationDto,
} from "./tenancy.schemas.js";

const toInvitationDto = (invitation: {
  id: string;
  organizationId: string;
  email: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  status: InvitationStatus;
  role: { code: RoleCode };
}): InvitationDto => ({
  id: invitation.id,
  organizationId: invitation.organizationId,
  email: invitation.email,
  token: invitation.token,
  role: invitation.role.code,
  status: invitation.status,
  expiresAt: invitation.expiresAt.toISOString(),
  createdAt: invitation.createdAt.toISOString(),
});

const toMembershipDto = (membership: {
  id: string;
  organizationId: string;
  createdAt: Date;
  user: { id: string; email: string; displayName: string };
  role: { code: RoleCode };
}): MembershipDto => ({
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

export class InvitationService {
  public constructor(
    private readonly transactionRunner: TransactionRunner,
    private readonly roleRepository: RoleRepository,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly invitationRepository: OrganizationInvitationRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly invitationTtlHours: number,
  ) {}

  public async inviteMember(
    context: RequestContext,
    organizationId: string,
    input: InviteMemberInput,
  ): Promise<InvitationDto> {
    const email = normalizeEmail(input.email);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(
          db,
          context,
          organizationId,
          "organization.invite_member",
        );

        const role = await this.roleRepository.findByCode(db, input.role);
        if (!role) {
          throw new NotFoundError(`Role ${input.role} does not exist.`);
        }

        const existingInvite = await this.invitationRepository.findPendingByOrganizationAndEmail(db, {
          organizationId,
          email,
        });
        if (existingInvite) {
          throw new ConflictError("A pending invitation already exists for this email.");
        }

        const existingUser = await this.userRepository.findByEmail(db, email);
        if (existingUser) {
          const existingMembership = await this.membershipRepository.findByUserAndOrganization(db, {
            organizationId,
            userId: existingUser.id,
          });

          if (existingMembership) {
            throw new ConflictError("The user is already a member of this organization.");
          }
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.invitationTtlHours * 60 * 60 * 1000);

        const invitation = await this.invitationRepository.create(db, {
          organizationId,
          email,
          roleId: role.id,
          token: randomUUID(),
          invitedByUserId: context.user.id,
          expiresAt,
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "organization.invitation.created",
          entityType: "OrganizationInvitation",
          entityId: invitation.id,
          payload: {
            email,
            role: role.code,
            expiresAt: invitation.expiresAt.toISOString(),
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "organization.invitation.created",
          aggregateType: "OrganizationInvitation",
          aggregateId: invitation.id,
          payload: {
            organizationId,
            email,
            role: role.code,
          },
        });

        return toInvitationDto(invitation);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Invitation token or membership uniqueness constraint was violated.");
      }

      throw error;
    }
  }

  public async acceptInvitation(
    context: RequestContext,
    input: AcceptInvitationInput,
  ): Promise<AcceptInvitationResultDto> {
    try {
      return await this.transactionRunner.run(async (db) => {
        const invitation = await this.invitationRepository.findByToken(db, input.token);
        if (!invitation) {
          throw new NotFoundError("Invitation token was not found.");
        }

        if (context.activeOrganizationId !== null && context.activeOrganizationId !== invitation.organizationId) {
          throw new ForbiddenError("Active organization context does not match the invitation organization.");
        }

        if (invitation.status !== InvitationStatus.pending) {
          throw new ConflictError("Invitation is no longer pending.");
        }

        const now = new Date();
        if (invitation.expiresAt.getTime() <= now.getTime()) {
          await this.invitationRepository.markExpired(db, invitation.id);
          throw new ConflictError("Invitation has expired.");
        }

        if (normalizeEmail(context.user.email) !== normalizeEmail(invitation.email)) {
          throw new ForbiddenError("Invitation email does not match the authenticated user.");
        }

        const existingMembership = await this.membershipRepository.findByUserAndOrganization(db, {
          organizationId: invitation.organizationId,
          userId: context.user.id,
        });
        if (existingMembership) {
          throw new ConflictError("User is already a member of this organization.");
        }

        await this.billingEntitlementService.ensureNewMembershipAllowedInTransaction(db, {
          organizationId: invitation.organizationId,
        });

        const acceptedInvitation = await this.invitationRepository.markAccepted(db, {
          id: invitation.id,
          acceptedByUserId: context.user.id,
          acceptedAt: now,
        });

        const membership = await this.membershipRepository.create(db, {
          organizationId: invitation.organizationId,
          userId: context.user.id,
          roleId: invitation.roleId,
        });

        await this.billingEntitlementService.recordCurrentUsageInTransaction(db, {
          organizationId: invitation.organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          meterTypes: [UsageMeterType.users],
          sourceType: "membership_created",
          sourceReference: membership.id,
        });

        await this.auditEventRepository.create(db, {
          organizationId: invitation.organizationId,
          actorUserId: context.user.id,
          eventType: "organization.invitation.accepted",
          entityType: "OrganizationMembership",
          entityId: membership.id,
          payload: {
            invitationId: invitation.id,
            role: invitation.role.code,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId: invitation.organizationId,
          eventType: "organization.membership.created",
          aggregateType: "OrganizationMembership",
          aggregateId: membership.id,
          payload: {
            invitationId: invitation.id,
            organizationId: invitation.organizationId,
            userId: context.user.id,
            role: invitation.role.code,
          },
        });

        return {
          membership: toMembershipDto(membership),
          invitationId: acceptedInvitation.id,
          organization: toOrganizationDto(invitation.organization),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("User is already a member of this organization.");
      }

      throw error;
    }
  }
}
