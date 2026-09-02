import type { Prisma, PurchaseOrder, PurchaseOrderStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const purchaseOrderInclude = {
  lines: true,
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderWithLines = Prisma.PurchaseOrderGetPayload<{
  include: typeof purchaseOrderInclude;
}>;

export class PurchaseOrderRepository {
  public create(db: DbClient, data: Prisma.PurchaseOrderUncheckedCreateInput): Promise<PurchaseOrder> {
    return db.purchaseOrder.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<PurchaseOrderWithLines | null> {
    return db.purchaseOrder.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
      include: purchaseOrderInclude,
    });
  }

  public findByNumberForOrganization(
    db: DbClient,
    input: { organizationId: string; poNumber: string },
  ): Promise<PurchaseOrderWithLines | null> {
    return db.purchaseOrder.findFirst({
      where: {
        organizationId: input.organizationId,
        poNumber: input.poNumber,
      },
      include: purchaseOrderInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: PurchaseOrderStatus; supplierId?: string },
  ): Promise<PurchaseOrderWithLines[]> {
    return db.purchaseOrder.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      },
      include: purchaseOrderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public listOpenBySkuLocation(
    db: DbClient,
    input: { organizationId: string; skuId: string; locationId: string },
  ): Promise<PurchaseOrderWithLines[]> {
    return db.purchaseOrder.findMany({
      where: {
        organizationId: input.organizationId,
        status: {
          in: ["submitted", "delayed", "partially_received"],
        },
        lines: {
          some: {
            skuId: input.skuId,
            expectedLocationId: input.locationId,
          },
        },
      },
      include: purchaseOrderInclude,
      orderBy: [{ orderedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  }

  public updateForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string; data: Prisma.PurchaseOrderUncheckedUpdateInput },
  ): Promise<PurchaseOrderWithLines> {
    return db.purchaseOrder.update({
      where: { id: input.id },
      data: input.data,
      include: purchaseOrderInclude,
    });
  }
}
