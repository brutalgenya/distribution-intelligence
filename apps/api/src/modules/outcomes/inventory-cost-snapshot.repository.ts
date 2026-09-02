import type { InventoryCostSnapshot, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class InventoryCostSnapshotRepository {
  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      skuId: string;
      locationId: string;
      snapshotAt: Date;
      create: Prisma.InventoryCostSnapshotUncheckedCreateInput;
      update: Prisma.InventoryCostSnapshotUncheckedUpdateInput;
    },
  ): Promise<InventoryCostSnapshot> {
    return db.inventoryCostSnapshot.upsert({
      where: {
        organizationId_skuId_locationId_snapshotAt: {
          organizationId: input.organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
          snapshotAt: input.snapshotAt,
        },
      },
      create: input.create,
      update: input.update,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; skuId?: string; locationId?: string },
  ): Promise<InventoryCostSnapshot[]> {
    return db.inventoryCostSnapshot.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
      orderBy: [{ snapshotAt: "desc" }, { id: "desc" }],
    });
  }
}
