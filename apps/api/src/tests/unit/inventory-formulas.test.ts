import { describe, expect, it } from "vitest";

import {
  AVAILABLE_TO_PROMISE_FORMULA,
  computeInventoryPositionQuantities,
} from "../../modules/inventory/inventory-formulas.js";

describe("inventory formulas", () => {
  it("computes deterministic canonical quantities", () => {
    const result = computeInventoryPositionQuantities({
      movements: [
        { movementType: "receipt", quantity: 20 },
        { movementType: "adjustment", quantity: -2 },
        { movementType: "transfer_out", quantity: 5 },
        { movementType: "transfer_in", quantity: 3 },
        { movementType: "reservation", quantity: 6 },
      ],
      reservedQty: 6,
      inTransitQty: 4,
    });

    expect(AVAILABLE_TO_PROMISE_FORMULA).toBe("onHandQty - reservedQty + inTransitQty");
    expect(result).toEqual({
      onHandQty: 16,
      reservedQty: 6,
      inTransitQty: 4,
      availableToPromiseQty: 14,
    });
  });
});
