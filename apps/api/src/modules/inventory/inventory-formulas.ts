import type { InventoryMovementType } from "@prisma/client";

export interface InventoryMovementLike {
  movementType: InventoryMovementType;
  quantity: number;
}

export interface InventoryPositionQuantities {
  onHandQty: number;
  reservedQty: number;
  inTransitQty: number;
  availableToPromiseQty: number;
}

export const AVAILABLE_TO_PROMISE_FORMULA = "onHandQty - reservedQty + inTransitQty";

export const computeOnHandQty = (movements: InventoryMovementLike[]): number =>
  movements.reduce((total, movement) => {
    switch (movement.movementType) {
      case "receipt":
      case "transfer_in":
        return total + movement.quantity;
      case "transfer_out":
        return total - movement.quantity;
      case "adjustment":
        return total + movement.quantity;
      case "reservation":
      case "reservation_release":
        return total;
    }
  }, 0);

export const computeInventoryPositionQuantities = (input: {
  movements: InventoryMovementLike[];
  reservedQty: number;
  inTransitQty: number;
}): InventoryPositionQuantities => {
  const onHandQty = computeOnHandQty(input.movements);

  return {
    onHandQty,
    reservedQty: input.reservedQty,
    inTransitQty: input.inTransitQty,
    // Canonical ATP formula for Phase 2:
    // on-hand inventory minus active reservations plus inbound requested transfers.
    availableToPromiseQty: onHandQty - input.reservedQty + input.inTransitQty,
  };
};
