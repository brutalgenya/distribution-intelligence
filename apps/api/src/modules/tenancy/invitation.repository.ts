import { InvitationStatus, type Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const invitationInclude = {
  role: true,
  organization: true,
} satisfies Prisma.OrganizationInvitationInclude;

export type InvitationWithRoleAndOrganization = Prisma.OrganizationInvitationGetPayload<{
  include: typeof invitationInclude;
}>;

export class OrganizationInvitationRepository {
  public create(
    db: DbClient,
    data: Prisma.OrganizationInvitationUncheckedCreateInput,
  ): Promise<InvitationWithRoleAndOrganization> {
    return db.organizationInvitation.create({
      data,
      include: invitationInclude,
    });
  }

  public findPendingByOrganizationAndEmail(
    db: DbClient,
    input: { organizationId: string; email: string },
  ): Promise<InvitationWithRoleAndOrganization | null> {
    return db.organizationInvitation.findFirst({
      where: {
        organizationId: input.organizationId,
        email: input.email,
        status: InvitationStatus.pending,
      },
      include: invitationInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  public findByToken(db: DbClient, token: string): Promise<InvitationWithRoleAndOrganization | null> {
    return db.organizationInvitation.findUnique({
      where: { token },
      include: invitationInclude,
    });
  }

  public markAccepted(
    db: DbClient,
    input: { id: string; acceptedByUserId: string; acceptedAt: Date },
  ): Promise<InvitationWithRoleAndOrganization> {
    return db.organizationInvitation.update({
      where: { id: input.id },
      data: {
        status: InvitationStatus.accepted,
        acceptedByUserId: input.acceptedByUserId,
        acceptedAt: input.acceptedAt,
      },
      include: invitationInclude,
    });
  }

  public markExpired(db: DbClient, id: string): Promise<void> {
    return db.organizationInvitation
      .update({
        where: { id },
        data: {
          status: InvitationStatus.expired,
        },
      })
      .then(() => undefined);
  }
}
