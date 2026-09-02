import type { Prisma, Supplier, SupplierStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class SupplierRepository {
  public create(db: DbClient, data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
    return db.supplier.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<Supplier | null> {
    return db.supplier.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: SupplierStatus },
  ): Promise<Supplier[]> {
    return db.supplier.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public updateForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string; data: Prisma.SupplierUncheckedUpdateInput },
  ): Promise<Supplier> {
    return db.supplier.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
