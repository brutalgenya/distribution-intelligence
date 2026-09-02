import type { InventoryTransfer, Prisma } from "@prisma/client";
import { InventoryTransferStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { InventoryPositionScope } from "./inventory-position.repository.js";

export class InventoryTransferRepository {
  public create(db: DbClient, data: Prisma.InventoryTransferUncheckedCreateInput): Promise<InventoryTransfer> {
    return db.inventoryTransfer.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<InventoryTransfer | null> {
    return db.inventoryTransfer.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public markCompleted(
    db: DbClient,
    input: { id: string; completedByUserId: string; completedAt: Date },
  ): Promise<InventoryTransfer> {
    return db.inventoryTransfer.update({
      where: {
        id: input.id,
      },
      data: {
        status: InventoryTransferStatus.completed,
        completedByUserId: input.completedByUserId,
        completedAt: input.completedAt,
      },
    });
  }

  public async sumRequestedInboundQuantity(db: DbClient, input: InventoryPositionScope): Promise<number> {
    const result = await db.inventoryTransfer.aggregate({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        destinationLocationId: input.locationId,
        status: InventoryTransferStatus.requested,
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity ?? 0;
  }

  public listInboundByScope(db: DbClient, input: InventoryPositionScope): Promise<InventoryTransfer[]> {
    return db.inventoryTransfer.findMany({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        destinationLocationId: input.locationId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
