import {
  StripeEventProcessingStatus,
  type Prisma,
  type StripeEventLog,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class StripeEventLogRepository {
  public create(
    db: DbClient,
    data: Prisma.StripeEventLogUncheckedCreateInput,
  ): Promise<StripeEventLog> {
    return db.stripeEventLog.create({ data });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.StripeEventLogUncheckedUpdateInput },
  ): Promise<StripeEventLog> {
    return db.stripeEventLog.update({
      where: { id: input.id },
      data: input.data,
    });
  }

  public findByStripeEventId(db: DbClient, stripeEventId: string): Promise<StripeEventLog | null> {
    return db.stripeEventLog.findUnique({
      where: { stripeEventId },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; processingStatus?: StripeEventProcessingStatus },
  ): Promise<StripeEventLog[]> {
    return db.stripeEventLog.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.processingStatus ? { processingStatus: input.processingStatus } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<StripeEventLog | null> {
    return db.stripeEventLog.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }
}
