import type { Prisma, SupplierLeadTimeStat } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class SupplierLeadTimeStatRepository {
  public deleteBySupplier(
    db: DbClient,
    input: { organizationId: string; supplierId: string },
  ): Promise<void> {
    return db.supplierLeadTimeStat
      .deleteMany({
        where: {
          organizationId: input.organizationId,
          supplierId: input.supplierId,
        },
      })
      .then(() => undefined);
  }

  public createMany(db: DbClient, data: Prisma.SupplierLeadTimeStatCreateManyInput[]): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.supplierLeadTimeStat.createMany({ data }).then(() => undefined);
  }

  public listBySupplier(
    db: DbClient,
    input: { organizationId: string; supplierId: string },
  ): Promise<SupplierLeadTimeStat[]> {
    return db.supplierLeadTimeStat.findMany({
      where: {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
      },
      orderBy: [{ updatedAt: "desc" }, { skuId: "asc" }, { id: "asc" }],
    });
  }

  public findBySupplierAndSku(
    db: DbClient,
    input: { organizationId: string; supplierId: string; skuId: string },
  ): Promise<SupplierLeadTimeStat | null> {
    return db.supplierLeadTimeStat.findFirst({
      where: {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        skuId: input.skuId,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }
}
