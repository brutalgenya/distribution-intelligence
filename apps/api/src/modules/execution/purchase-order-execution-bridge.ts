import { z } from "zod";

import type { ExecutionAdapterExecuteInput, ExecutionAdapterSuccessResult } from "./execution-adapter.js";
import { ExecutionAdapterError } from "./execution-adapter.js";
import { PurchaseOrderRepository } from "../supply/purchase-order.repository.js";
import { PurchaseOrderService } from "../supply/purchase-order.service.js";

const replenishmentExecutionPayloadSchema = z.object({
  decisionId: z.string().uuid(),
  skuId: z.string().uuid(),
  locationId: z.string().uuid(),
  supplierId: z.string().uuid(),
  recommendedOrderQty: z.coerce.number().int().positive(),
  unitOfMeasure: z.string().trim().min(1),
  expectedLeadTimeDays: z.coerce.number().int().positive().nullable().optional(),
  projectedDaysOfCover: z.coerce.number(),
  projectedShortfallQty: z.coerce.number(),
  basisDate: z.string().datetime(),
  recommendationType: z.string().trim().min(1),
});

const buildAutoPurchaseOrderNumber = (decisionId: string): string =>
  `AUTO-PO-${decisionId.replace(/-/g, "").slice(0, 20).toUpperCase()}`;

export class PurchaseOrderExecutionBridge {
  public constructor(
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {}

  public async execute(input: ExecutionAdapterExecuteInput): Promise<ExecutionAdapterSuccessResult> {
    const payload = replenishmentExecutionPayloadSchema.parse(input.task.payload);
    const poNumber = buildAutoPurchaseOrderNumber(payload.decisionId);

    const existingPurchaseOrder = await this.purchaseOrderRepository.findByNumberForOrganization(input.db, {
      organizationId: input.task.organizationId,
      poNumber,
    });
    if (existingPurchaseOrder) {
      return {
        responsePayload: {
          purchaseOrderId: existingPurchaseOrder.id,
          poNumber: existingPurchaseOrder.poNumber,
          status: existingPurchaseOrder.status,
          supplierId: existingPurchaseOrder.supplierId,
          reused: true,
        },
      };
    }

    const actorUserId = input.actorUserId ?? input.task.requestedByUserId;
    if (!actorUserId) {
      throw new ExecutionAdapterError(
        "missing_actor",
        "Purchase order execution requires a user context.",
        false,
      );
    }

    const purchaseOrder = await this.purchaseOrderService.createDraftInTransaction(input.db, {
      organizationId: input.task.organizationId,
      actorUserId,
      correlationId: input.correlationId,
      input: {
        supplierId: payload.supplierId,
        poNumber,
        notes: `Generated from decision ${payload.decisionId} via execution task ${input.task.id}.`,
        lines: [
          {
            skuId: payload.skuId,
            quantityOrdered: payload.recommendedOrderQty,
            expectedLocationId: payload.locationId,
          },
        ],
      },
    });

    return {
      responsePayload: {
        purchaseOrderId: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        status: purchaseOrder.status,
        supplierId: purchaseOrder.supplierId,
        reused: false,
      },
    };
  }
}
