import type { HistoricalSale, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface HistoricalSaleQuery {
  organizationId: string;
  observedAtGte?: Date;
  observedAtLte?: Date;
  createdAtLte?: Date;
  skuId?: string;
  locationId?: string;
}

export class HistoricalSaleRepository {
  public createMany(db: DbClient, data: Prisma.HistoricalSaleCreateManyInput[]): Promise<void> {
    return db.historicalSale.createMany({ data }).then(() => undefined);
  }

  public async findExistingFingerprints(
    db: DbClient,
    input: { organizationId: string; rowFingerprints: string[] },
  ): Promise<Set<string>> {
    if (input.rowFingerprints.length === 0) {
      return new Set<string>();
    }

    const rows = await db.historicalSale.findMany({
      where: {
        organizationId: input.organizationId,
        rowFingerprint: {
          in: input.rowFingerprints,
        },
      },
      select: {
        rowFingerprint: true,
      },
    });

    return new Set(rows.map((row) => row.rowFingerprint));
  }

  public listByOrganization(db: DbClient, input: HistoricalSaleQuery): Promise<HistoricalSale[]> {
    return db.historicalSale.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
        soldAt: {
          ...(input.observedAtGte ? { gte: input.observedAtGte } : {}),
          ...(input.observedAtLte ? { lte: input.observedAtLte } : {}),
        },
        ...(input.createdAtLte ? { createdAt: { lte: input.createdAtLte } } : {}),
      },
      orderBy: [{ soldAt: "asc" }, { id: "asc" }],
    });
  }
}
