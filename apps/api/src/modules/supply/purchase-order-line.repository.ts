import type { Prisma, PurchaseOrderLine } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class PurchaseOrderLineRepository {
  public createMany(db: DbClient, data: Prisma.PurchaseOrderLineCreateManyInput[]): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.purchaseOrderLine.createMany({ data }).then(() => undefined);
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.PurchaseOrderLineUncheckedUpdateInput },
  ): Promise<PurchaseOrderLine> {
    return db.purchaseOrderLine.update({
      where: { id: input.id },
      data: input.data,
    });
  }

  public listByPurchaseOrderId(db: DbClient, purchaseOrderId: string): Promise<PurchaseOrderLine[]> {
    return db.purchaseOrderLine.findMany({
      where: { purchaseOrderId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
