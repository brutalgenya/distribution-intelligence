import type { ForecastErrorMeasurement, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class ForecastErrorMeasurementRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<ForecastErrorMeasurement | null> {
    return db.forecastErrorMeasurement.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; skuId?: string; locationId?: string; forecastJobId?: string },
  ): Promise<ForecastErrorMeasurement[]> {
    return db.forecastErrorMeasurement.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.forecastJobId ? { forecastJobId: input.forecastJobId } : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      forecastJobId: string;
      skuId: string;
      locationId: string;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
      create: Prisma.ForecastErrorMeasurementUncheckedCreateInput;
      update: Prisma.ForecastErrorMeasurementUncheckedUpdateInput;
    },
  ): Promise<ForecastErrorMeasurement> {
    return db.forecastErrorMeasurement.upsert({
      where: {
        organizationId_forecastJobId_skuId_locationId_measurementWindowStart_measurementWindowEnd:
          {
            organizationId: input.organizationId,
            forecastJobId: input.forecastJobId,
            skuId: input.skuId,
            locationId: input.locationId,
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
      },
      create: input.create,
      update: input.update,
    });
  }
}
