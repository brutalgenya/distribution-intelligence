import type { DbClient } from "../../infrastructure/db/types.js";
import {
  computeInventoryPositionQuantities,
  type InventoryPositionQuantities,
} from "../inventory/inventory-formulas.js";
import { InventoryMovementRepository } from "../inventory/inventory-movement.repository.js";
import { InventoryReservationRepository } from "../inventory/inventory-reservation.repository.js";
import {
  InventoryTransferRepository,
} from "../inventory/inventory-transfer.repository.js";

export interface InventoryHistoryScope {
  organizationId: string;
  skuId: string;
  locationId: string;
}

export interface InventoryHistorySnapshot extends InventoryPositionQuantities {
  asOf: Date;
}

export class InventoryHistoryService {
  public constructor(
    private readonly inventoryMovementRepository: InventoryMovementRepository,
    private readonly inventoryReservationRepository: InventoryReservationRepository,
    private readonly inventoryTransferRepository: InventoryTransferRepository,
  ) {}

  public async calculateSnapshotAt(
    db: DbClient,
    scope: InventoryHistoryScope,
    asOf: Date,
  ): Promise<InventoryHistorySnapshot> {
    const [movements, reservations, inboundTransfers] = await Promise.all([
      this.inventoryMovementRepository.listByScope(db, scope),
      this.inventoryReservationRepository.listByScope(db, scope),
      this.inventoryTransferRepository.listInboundByScope(db, scope),
    ]);

    const movementSnapshot = movements.filter((movement) => movement.createdAt.getTime() <= asOf.getTime());
    const reservedQty = reservations
      .filter(
        (reservation) =>
          reservation.createdAt.getTime() <= asOf.getTime() &&
          (reservation.releasedAt === null || reservation.releasedAt.getTime() > asOf.getTime()),
      )
      .reduce((sum, reservation) => sum + reservation.quantity, 0);
    const inTransitQty = inboundTransfers
      .filter(
        (transfer) =>
          transfer.createdAt.getTime() <= asOf.getTime() &&
          (transfer.completedAt === null || transfer.completedAt.getTime() > asOf.getTime()),
      )
      .reduce((sum, transfer) => sum + transfer.quantity, 0);

    return {
      ...computeInventoryPositionQuantities({
        movements: movementSnapshot,
        reservedQty,
        inTransitQty,
      }),
      asOf,
    };
  }
}
