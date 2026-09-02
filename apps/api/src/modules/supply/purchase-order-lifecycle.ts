import { PurchaseOrderStatus, type PurchaseOrderLine } from "@prisma/client";

import { ConflictError } from "../../shared/errors.js";

const transitionMatrix: Record<PurchaseOrderStatus, ReadonlySet<PurchaseOrderStatus>> = {
  [PurchaseOrderStatus.draft]: new Set([PurchaseOrderStatus.submitted, PurchaseOrderStatus.cancelled]),
  [PurchaseOrderStatus.submitted]: new Set([
    PurchaseOrderStatus.partially_received,
    PurchaseOrderStatus.received,
    PurchaseOrderStatus.delayed,
    PurchaseOrderStatus.cancelled,
  ]),
  [PurchaseOrderStatus.partially_received]: new Set([PurchaseOrderStatus.received]),
  [PurchaseOrderStatus.received]: new Set(),
  [PurchaseOrderStatus.delayed]: new Set([
    PurchaseOrderStatus.partially_received,
    PurchaseOrderStatus.received,
    PurchaseOrderStatus.cancelled,
  ]),
  [PurchaseOrderStatus.cancelled]: new Set(),
};

const canTransition = (from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean =>
  transitionMatrix[from].has(to);

export const assertPurchaseOrderTransition = (
  currentStatus: PurchaseOrderStatus,
  nextStatus: PurchaseOrderStatus,
): void => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!canTransition(currentStatus, nextStatus)) {
    throw new ConflictError(`Purchase order transition ${currentStatus} -> ${nextStatus} is not allowed.`);
  }
};

export const derivePurchaseOrderReceiptStatus = (
  currentStatus: PurchaseOrderStatus,
  lines: Array<Pick<PurchaseOrderLine, "quantityOrdered" | "quantityReceived">>,
): PurchaseOrderStatus => {
  const totalOrdered = lines.reduce((sum, line) => sum + line.quantityOrdered, 0);
  const totalReceived = lines.reduce((sum, line) => sum + line.quantityReceived, 0);

  if (totalOrdered > 0 && totalReceived === totalOrdered) {
    const nextStatus = PurchaseOrderStatus.received;
    assertPurchaseOrderTransition(currentStatus, nextStatus);
    return nextStatus;
  }

  if (totalReceived > 0) {
    const nextStatus = PurchaseOrderStatus.partially_received;
    assertPurchaseOrderTransition(currentStatus, nextStatus);
    return nextStatus;
  }

  return currentStatus;
};

export const assertPurchaseOrderCanReceive = (status: PurchaseOrderStatus): void => {
  if (
    status !== PurchaseOrderStatus.submitted &&
    status !== PurchaseOrderStatus.delayed &&
    status !== PurchaseOrderStatus.partially_received &&
    status !== PurchaseOrderStatus.received
  ) {
    throw new ConflictError(`Purchase order in status ${status} cannot be received.`);
  }
};

export const assertPurchaseOrderCanCancel = (
  status: PurchaseOrderStatus,
  lines: Array<Pick<PurchaseOrderLine, "quantityReceived">>,
): void => {
  if (lines.some((line) => line.quantityReceived > 0)) {
    throw new ConflictError("Purchase orders with received quantities cannot be cancelled.");
  }

  assertPurchaseOrderTransition(status, PurchaseOrderStatus.cancelled);
};
