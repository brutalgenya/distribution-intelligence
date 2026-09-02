import type { Prisma, SalesImportRun, SalesImportRunStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class SalesImportRunRepository {
  public create(db: DbClient, data: Prisma.SalesImportRunUncheckedCreateInput): Promise<SalesImportRun> {
    return db.salesImportRun.create({ data });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.SalesImportRunUncheckedUpdateInput },
  ): Promise<SalesImportRun> {
    return db.salesImportRun.update({
      where: { id: input.id },
      data: input.data,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: SalesImportRunStatus },
  ): Promise<SalesImportRun[]> {
    return db.salesImportRun.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<SalesImportRun | null> {
    return db.salesImportRun.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }
}
