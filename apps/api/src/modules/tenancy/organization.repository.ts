import type { Organization, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class OrganizationRepository {
  public create(db: DbClient, data: Prisma.OrganizationUncheckedCreateInput): Promise<Organization> {
    return db.organization.create({ data });
  }

  public listAll(db: DbClient): Promise<Organization[]> {
    return db.organization.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public findById(db: DbClient, id: string): Promise<Organization | null> {
    return db.organization.findUnique({
      where: { id },
    });
  }
}
