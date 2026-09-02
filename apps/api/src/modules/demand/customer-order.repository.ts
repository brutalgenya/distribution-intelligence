import type { CustomerOrder, CustomerOrderStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const customerOrderInclude = {
  lines: true,
} satisfies Prisma.CustomerOrderInclude;

export type CustomerOrderWithLines = Prisma.CustomerOrderGetPayload<{
  include: typeof customerOrderInclude;
}>;

export class CustomerOrderRepository {
  public create(db: DbClient, data: Prisma.CustomerOrderUncheckedCreateInput): Promise<CustomerOrder> {
    return db.customerOrder.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<CustomerOrderWithLines | null> {
    return db.customerOrder.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: customerOrderInclude,
    });
  }

  public findById(db: DbClient, id: string): Promise<CustomerOrderWithLines | null> {
    return db.customerOrder.findUnique({
      where: { id },
      include: customerOrderInclude,
    });
  }

  public findByOrderNumberForOrganization(
    db: DbClient,
    input: { organizationId: string; orderNumber: string },
  ): Promise<CustomerOrderWithLines | null> {
    return db.customerOrder.findFirst({
      where: {
        organizationId: input.organizationId,
        orderNumber: input.orderNumber,
      },
      include: customerOrderInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: CustomerOrderStatus },
  ): Promise<CustomerOrderWithLines[]> {
    return db.customerOrder.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      include: customerOrderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public listByOrderedAtWindow(
    db: DbClient,
    input: {
      organizationId: string;
      orderedAtGte: Date;
      orderedAtLte: Date;
      skuId?: string;
      locationId?: string;
    },
  ): Promise<CustomerOrderWithLines[]> {
    return db.customerOrder.findMany({
      where: {
        organizationId: input.organizationId,
        orderedAt: {
          gte: input.orderedAtGte,
          lte: input.orderedAtLte,
        },
        lines: {
          some: {
            ...(input.skuId ? { skuId: input.skuId } : {}),
            ...(input.locationId ? { locationId: input.locationId } : {}),
          },
        },
      },
      include: customerOrderInclude,
      orderBy: [{ orderedAt: "asc" }, { orderNumber: "asc" }, { id: "asc" }],
    });
  }

  public listOpenBySkuLocation(
    db: DbClient,
    input: { organizationId: string; skuId: string; locationId: string },
  ): Promise<CustomerOrderWithLines[]> {
    return db.customerOrder.findMany({
      where: {
        organizationId: input.organizationId,
        status: "open",
        lines: {
          some: {
            skuId: input.skuId,
            locationId: input.locationId,
          },
        },
      },
      include: customerOrderInclude,
      orderBy: [{ orderedAt: "asc" }, { orderNumber: "asc" }, { id: "asc" }],
    });
  }

  public markCancelled(
    db: DbClient,
    input: { id: string; cancelledAt: Date; cancelledByUserId: string },
  ): Promise<CustomerOrderWithLines> {
    return db.customerOrder.update({
      where: { id: input.id },
      data: {
        status: "cancelled",
        cancelledAt: input.cancelledAt,
        cancelledByUserId: input.cancelledByUserId,
      },
      include: customerOrderInclude,
    });
  }
}
