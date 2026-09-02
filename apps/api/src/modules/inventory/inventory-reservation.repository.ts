import type { InventoryReservation, Prisma } from "@prisma/client";
import { InventoryReservationStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import type { InventoryPositionScope } from "./inventory-position.repository.js";

export class InventoryReservationRepository {
  public create(
    db: DbClient,
    data: Prisma.InventoryReservationUncheckedCreateInput,
  ): Promise<InventoryReservation> {
    return db.inventoryReservation.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<InventoryReservation | null> {
    return db.inventoryReservation.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public markReleased(
    db: DbClient,
    input: { id: string; releasedAt: Date },
  ): Promise<InventoryReservation> {
    return db.inventoryReservation.update({
      where: {
        id: input.id,
      },
      data: {
        status: InventoryReservationStatus.released,
        releasedAt: input.releasedAt,
      },
    });
  }

  public listByScope(db: DbClient, input: InventoryPositionScope): Promise<InventoryReservation[]> {
    return db.inventoryReservation.findMany({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public async sumActiveQuantity(db: DbClient, input: InventoryPositionScope): Promise<number> {
    const result = await db.inventoryReservation.aggregate({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        status: InventoryReservationStatus.active,
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity ?? 0;
  }
}
