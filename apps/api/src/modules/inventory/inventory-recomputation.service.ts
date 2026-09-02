import type { DbClient } from "../../infrastructure/db/types.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  AVAILABLE_TO_PROMISE_FORMULA,
  computeInventoryPositionQuantities,
  type InventoryPositionQuantities,
} from "./inventory-formulas.js";
import {
  InventoryPositionRepository,
  type InventoryPositionScope,
} from "./inventory-position.repository.js";
import { InventoryMovementRepository } from "./inventory-movement.repository.js";
import { InventoryReservationRepository } from "./inventory-reservation.repository.js";
import { InventoryTransferRepository } from "./inventory-transfer.repository.js";

interface RecomputePositionOptions {
  emitOutboxEvent?: boolean;
}

const didPositionChange = (
  current:
    | {
        onHandQty: number;
        reservedQty: number;
        inTransitQty: number;
        availableToPromiseQty: number;
      }
    | null,
  next: InventoryPositionQuantities,
): boolean =>
  current === null ||
  current.onHandQty !== next.onHandQty ||
  current.reservedQty !== next.reservedQty ||
  current.inTransitQty !== next.inTransitQty ||
  current.availableToPromiseQty !== next.availableToPromiseQty;

export class InventoryRecomputationService {
  public constructor(
    private readonly inventoryPositionRepository: InventoryPositionRepository,
    private readonly inventoryMovementRepository: InventoryMovementRepository,
    private readonly inventoryReservationRepository: InventoryReservationRepository,
    private readonly inventoryTransferRepository: InventoryTransferRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async calculatePositionQuantities(
    db: DbClient,
    scope: InventoryPositionScope,
  ): Promise<InventoryPositionQuantities> {
    const [movements, reservedQty, inTransitQty] = await Promise.all([
      this.inventoryMovementRepository.listByScope(db, scope),
      this.inventoryReservationRepository.sumActiveQuantity(db, scope),
      this.inventoryTransferRepository.sumRequestedInboundQuantity(db, scope),
    ]);

    return computeInventoryPositionQuantities({
      movements,
      reservedQty,
      inTransitQty,
    });
  }

  public async recomputePosition(
    db: DbClient,
    scope: InventoryPositionScope,
    options: RecomputePositionOptions = {},
  ) {
    const currentPosition = await this.inventoryPositionRepository.findByScope(db, scope);
    const nextQuantities = await this.calculatePositionQuantities(db, scope);

    const positionChanged = didPositionChange(currentPosition, nextQuantities);

    const position =
      currentPosition !== null && !positionChanged
        ? currentPosition
        : await this.inventoryPositionRepository.upsert(db, {
            organizationId: scope.organizationId,
            skuId: scope.skuId,
            locationId: scope.locationId,
            onHandQty: nextQuantities.onHandQty,
            reservedQty: nextQuantities.reservedQty,
            inTransitQty: nextQuantities.inTransitQty,
            availableToPromiseQty: nextQuantities.availableToPromiseQty,
            safetyStockQty: currentPosition?.safetyStockQty ?? 0,
            reorderPointQty: currentPosition?.reorderPointQty ?? 0,
          });

    if (options.emitOutboxEvent && positionChanged) {
      await this.outboxEventRepository.create(db, {
        organizationId: scope.organizationId,
        eventType: "inventory.position.recomputed.v1",
        aggregateType: "InventoryPosition",
        aggregateId: position.id,
        payload: {
          organizationId: scope.organizationId,
          skuId: scope.skuId,
          locationId: scope.locationId,
          formula: AVAILABLE_TO_PROMISE_FORMULA,
          previous: currentPosition
            ? {
                onHandQty: currentPosition.onHandQty,
                reservedQty: currentPosition.reservedQty,
                inTransitQty: currentPosition.inTransitQty,
                availableToPromiseQty: currentPosition.availableToPromiseQty,
              }
            : null,
          current: {
            onHandQty: nextQuantities.onHandQty,
            reservedQty: nextQuantities.reservedQty,
            inTransitQty: nextQuantities.inTransitQty,
            availableToPromiseQty: nextQuantities.availableToPromiseQty,
          },
        },
      });
    }

    return position;
  }
}
