import type { InventoryPosition, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface InventoryPositionScope {
  organizationId: string;
  skuId: string;
  locationId: string;
}

export interface ListInventoryPositionsInput {
  organizationId: string;
  skuId?: string;
  locationId?: string;
}

export interface UpsertInventoryPositionInput extends InventoryPositionScope {
  onHandQty: number;
  reservedQty: number;
  inTransitQty: number;
  availableToPromiseQty: number;
  safetyStockQty: number;
  reorderPointQty: number;
}

export class InventoryPositionRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<InventoryPosition | null> {
    return db.inventoryPosition.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public findByScope(db: DbClient, input: InventoryPositionScope): Promise<InventoryPosition | null> {
    return db.inventoryPosition.findUnique({
      where: {
        organizationId_skuId_locationId: {
          organizationId: input.organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
        },
      },
    });
  }

  public listByOrganization(db: DbClient, input: ListInventoryPositionsInput): Promise<InventoryPosition[]> {
    return db.inventoryPosition.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  public upsert(db: DbClient, input: UpsertInventoryPositionInput): Promise<InventoryPosition> {
    const data: Prisma.InventoryPositionUncheckedCreateInput = {
      organizationId: input.organizationId,
      skuId: input.skuId,
      locationId: input.locationId,
      onHandQty: input.onHandQty,
      reservedQty: input.reservedQty,
      inTransitQty: input.inTransitQty,
      availableToPromiseQty: input.availableToPromiseQty,
      safetyStockQty: input.safetyStockQty,
      reorderPointQty: input.reorderPointQty,
    };

    return db.inventoryPosition.upsert({
      where: {
        organizationId_skuId_locationId: {
          organizationId: input.organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
        },
      },
      update: {
        onHandQty: input.onHandQty,
        reservedQty: input.reservedQty,
        inTransitQty: input.inTransitQty,
        availableToPromiseQty: input.availableToPromiseQty,
        safetyStockQty: input.safetyStockQty,
        reorderPointQty: input.reorderPointQty,
      },
      create: data,
    });
  }
}
