import type { DemandSignal, DemandSignalType, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface DemandSignalQuery {
  organizationId: string;
  observedAtGte?: Date;
  observedAtLte?: Date;
  createdAtLte?: Date;
  skuId?: string;
  locationId?: string | null;
  signalTypes?: DemandSignalType[];
}

export class DemandSignalRepository {
  public createMany(db: DbClient, data: Prisma.DemandSignalCreateManyInput[]): Promise<void> {
    return db.demandSignal.createMany({ data }).then(() => undefined);
  }

  public listByOrganization(db: DbClient, input: DemandSignalQuery): Promise<DemandSignal[]> {
    return db.demandSignal.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(input.signalTypes ? { signalType: { in: input.signalTypes } } : {}),
        observedAt: {
          ...(input.observedAtGte ? { gte: input.observedAtGte } : {}),
          ...(input.observedAtLte ? { lte: input.observedAtLte } : {}),
        },
        ...(input.createdAtLte ? { createdAt: { lte: input.createdAtLte } } : {}),
      },
      orderBy: [{ observedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  }
}
