import type { ForecastResult, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class ForecastResultRepository {
  public listByJobIdForOrganization(
    db: DbClient,
    input: { organizationId: string; forecastJobId: string },
  ): Promise<ForecastResult[]> {
    return db.forecastResult.findMany({
      where: {
        organizationId: input.organizationId,
        forecastJobId: input.forecastJobId,
      },
      orderBy: [{ forecastDate: "asc" }, { skuId: "asc" }, { id: "asc" }],
    });
  }

  public listByOrganizationWindow(
    db: DbClient,
    input: {
      organizationId: string;
      forecastDateGte: Date;
      forecastDateLte: Date;
      skuId?: string;
      locationId?: string;
      forecastJobId?: string;
    },
  ): Promise<ForecastResult[]> {
    return db.forecastResult.findMany({
      where: {
        organizationId: input.organizationId,
        forecastDate: {
          gte: input.forecastDateGte,
          lte: input.forecastDateLte,
        },
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.forecastJobId ? { forecastJobId: input.forecastJobId } : {}),
      },
      orderBy: [{ forecastDate: "asc" }, { skuId: "asc" }, { id: "asc" }],
    });
  }

  public deleteByJobId(db: DbClient, forecastJobId: string): Promise<void> {
    return db.forecastResult.deleteMany({ where: { forecastJobId } }).then(() => undefined);
  }

  public createMany(db: DbClient, data: Prisma.ForecastResultCreateManyInput[]): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.forecastResult.createMany({ data }).then(() => undefined);
  }
}
