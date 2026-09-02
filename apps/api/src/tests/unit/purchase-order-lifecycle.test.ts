import { PurchaseOrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ConflictError } from "../../shared/errors.js";
import {
  assertPurchaseOrderTransition,
  derivePurchaseOrderReceiptStatus,
} from "../../modules/supply/purchase-order-lifecycle.js";

describe("purchase-order-lifecycle", () => {
  it("rejects invalid state transitions", () => {
    expect(() =>
      assertPurchaseOrderTransition(PurchaseOrderStatus.draft, PurchaseOrderStatus.received),
    ).toThrowError(ConflictError);
  });

  it("derives partial and full receipt states deterministically", () => {
    const partiallyReceived = derivePurchaseOrderReceiptStatus(PurchaseOrderStatus.submitted, [
      {
        quantityOrdered: 10,
        quantityReceived: 4,
      },
    ]);

    const fullyReceived = derivePurchaseOrderReceiptStatus(PurchaseOrderStatus.partially_received, [
      {
        quantityOrdered: 10,
        quantityReceived: 10,
      },
    ]);

    expect(partiallyReceived).toBe(PurchaseOrderStatus.partially_received);
    expect(fullyReceived).toBe(PurchaseOrderStatus.received);
  });
});
