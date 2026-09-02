import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const membershipInclude = {
  role: true,
  user: true,
} satisfies Prisma.OrganizationMembershipInclude;

export type MembershipWithUserAndRole = Prisma.OrganizationMembershipGetPayload<{
  include: typeof membershipInclude;
}>;

export class OrganizationMembershipRepository {
  public create(
    db: DbClient,
    data: Prisma.OrganizationMembershipUncheckedCreateInput,
  ): Promise<MembershipWithUserAndRole> {
    return db.organizationMembership.create({
      data,
      include: membershipInclude,
    });
  }

  public findByUserAndOrganization(
    db: DbClient,
    input: { organizationId: string; userId: string },
  ): Promise<MembershipWithUserAndRole | null> {
    return db.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      include: membershipInclude,
    });
  }

  public listByOrganization(db: DbClient, organizationId: string): Promise<MembershipWithUserAndRole[]> {
    return db.organizationMembership.findMany({
      where: { organizationId },
      include: membershipInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public countByOrganization(db: DbClient, organizationId: string): Promise<number> {
    return db.organizationMembership.count({
      where: { organizationId },
    });
  }
}
