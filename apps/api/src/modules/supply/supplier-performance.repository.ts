import type { Prisma, SupplierPerformanceSnapshot } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class SupplierPerformanceSnapshotRepository {
  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      supplierId: string;
      data: Prisma.SupplierPerformanceSnapshotUncheckedCreateInput;
      update: Prisma.SupplierPerformanceSnapshotUncheckedUpdateInput;
    },
  ): Promise<SupplierPerformanceSnapshot> {
    return db.supplierPerformanceSnapshot.upsert({
      where: {
        organizationId_supplierId: {
          organizationId: input.organizationId,
          supplierId: input.supplierId,
        },
      },
      create: input.data,
      update: input.update,
    });
  }

  public findBySupplier(
    db: DbClient,
    input: { organizationId: string; supplierId: string },
  ): Promise<SupplierPerformanceSnapshot | null> {
    return db.supplierPerformanceSnapshot.findUnique({
      where: {
        organizationId_supplierId: {
          organizationId: input.organizationId,
          supplierId: input.supplierId,
        },
      },
    });
  }
}
