import type { InventoryMovement, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { InventoryPositionScope } from "./inventory-position.repository.js";

export class InventoryMovementRepository {
  public create(db: DbClient, data: Prisma.InventoryMovementUncheckedCreateInput): Promise<InventoryMovement> {
    return db.inventoryMovement.create({ data });
  }

  public listByScope(db: DbClient, input: InventoryPositionScope): Promise<InventoryMovement[]> {
    return db.inventoryMovement.findMany({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
