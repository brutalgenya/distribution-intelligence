import { PurchaseOrderStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PurchaseOrderExecutionBridge } from "../../modules/execution/purchase-order-execution-bridge.js";
import type { ExecutionTaskWithAttempts } from "../../modules/execution/execution-task.repository.js";
import type { PurchaseOrderRepository } from "../../modules/supply/purchase-order.repository.js";
import type { PurchaseOrderService } from "../../modules/supply/purchase-order.service.js";

const task: ExecutionTaskWithAttempts = {
  id: "execution-task-id",
  organizationId: "organization-id",
  decisionId: "decision-id",
  taskType: "create_purchase_order",
  status: "running",
  targetSystem: "internal_supply",
  payload: {
    decisionId: "44444444-4444-4444-8444-444444444444",
    skuId: "55555555-5555-4555-8555-555555555555",
    locationId: "66666666-6666-4666-8666-666666666666",
    supplierId: "77777777-7777-4777-8777-777777777777",
    recommendedOrderQty: 24,
    unitOfMeasure: "each",
    expectedLeadTimeDays: 7,
    projectedDaysOfCover: 4,
    projectedShortfallQty: 24,
    basisDate: "2026-03-28T00:00:00.000Z",
    recommendationType: "replenishment",
  },
  requestedByUserId: "owner-id",
  requestedAt: new Date("2026-03-28T00:00:00.000Z"),
  startedAt: new Date("2026-03-28T00:01:00.000Z"),
  completedAt: null,
  failedAt: null,
  lastError: null,
  retryCount: 0,
  nextRetryAt: null,
  createdAt: new Date("2026-03-28T00:00:00.000Z"),
  updatedAt: new Date("2026-03-28T00:01:00.000Z"),
  attempts: [],
};

describe("PurchaseOrderExecutionBridge", () => {
  it("reuses an existing auto-generated purchase order instead of duplicating it", async () => {
    const purchaseOrderRepository = {
      findByNumberForOrganization: vi.fn().mockResolvedValue({
        id: "po-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        poNumber: "AUTO-PO-DECISIONID",
        status: PurchaseOrderStatus.draft,
        orderedAt: null,
        expectedDeliveryAt: null,
        receivedAt: null,
        currency: null,
        notes: null,
        wasEverDelayed: false,
        delayedAt: null,
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        lines: [],
      }),
    } as unknown as PurchaseOrderRepository;

    const purchaseOrderService = {
      createDraftInTransaction: vi.fn(),
    } as unknown as PurchaseOrderService;

    const bridge = new PurchaseOrderExecutionBridge(purchaseOrderRepository, purchaseOrderService);

    const result = await bridge.execute({
      db: {} as Prisma.TransactionClient,
      task,
      idempotencyKey: {
        id: "idempotency-id",
        organizationId: "organization-id",
        scopeType: "execution_task",
        scopeReference: { executionTaskId: task.id },
        key: `execution_task:${task.id}`,
        status: "pending",
        responseHash: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      },
      actorUserId: "owner-id",
      correlationId: "f63f930a-9021-4fcf-b1c8-99faa4d679f0",
    });

    expect(result.responsePayload).toEqual(
      expect.objectContaining({
        purchaseOrderId: "po-id",
        reused: true,
      }),
    );
    expect(vi.mocked(purchaseOrderService.createDraftInTransaction)).not.toHaveBeenCalled();
  });
});
