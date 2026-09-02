import type { FillRateMeasurement, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class FillRateMeasurementRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<FillRateMeasurement | null> {
    return db.fillRateMeasurement.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; skuId?: string; locationId?: string },
  ): Promise<FillRateMeasurement[]> {
    return db.fillRateMeasurement.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      skuId: string;
      locationId: string;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
      create: Prisma.FillRateMeasurementUncheckedCreateInput;
      update: Prisma.FillRateMeasurementUncheckedUpdateInput;
    },
  ): Promise<FillRateMeasurement> {
    return db.fillRateMeasurement.upsert({
      where: {
        organizationId_skuId_locationId_measurementWindowStart_measurementWindowEnd: {
          organizationId: input.organizationId,
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
