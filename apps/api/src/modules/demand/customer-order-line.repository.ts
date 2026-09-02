import type { CustomerOrderLine, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class CustomerOrderLineRepository {
  public createMany(db: DbClient, data: Prisma.CustomerOrderLineCreateManyInput[]): Promise<void> {
    return db.customerOrderLine.createMany({ data }).then(() => undefined);
  }

  public listByOrderId(db: DbClient, orderId: string): Promise<CustomerOrderLine[]> {
    return db.customerOrderLine.findMany({
      where: { orderId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
