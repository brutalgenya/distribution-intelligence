import {
  type Prisma,
  type UsageMeter,
  type UsageMeterType,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class UsageMeterRepository {
  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      meterType: UsageMeterType;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
      create: Prisma.UsageMeterUncheckedCreateInput;
      update: Prisma.UsageMeterUncheckedUpdateInput;
    },
  ): Promise<UsageMeter> {
    return db.usageMeter.upsert({
      where: {
        organizationId_meterType_measurementWindowStart_measurementWindowEnd: {
          organizationId: input.organizationId,
          meterType: input.meterType,
          measurementWindowStart: input.measurementWindowStart,
          measurementWindowEnd: input.measurementWindowEnd,
        },
      },
      create: input.create,
      update: input.update,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; meterType?: UsageMeterType },
  ): Promise<UsageMeter[]> {
    return db.usageMeter.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.meterType ? { meterType: input.meterType } : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { meterType: "asc" }],
    });
  }

  public listLatestByOrganization(
    db: DbClient,
    organizationId: string,
  ): Promise<UsageMeter[]> {
    return db.usageMeter.findMany({
      where: { organizationId },
      orderBy: [{ measurementWindowEnd: "desc" }, { meterType: "asc" }],
      distinct: ["meterType"],
    });
  }
}
