import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const enhancedForecastResultInclude = {
  modelRegistryEntry: true,
  aiRun: {
    include: {
      modelRegistryEntry: true,
    },
  },
} satisfies Prisma.EnhancedForecastResultInclude;

export type EnhancedForecastResultWithRelations = Prisma.EnhancedForecastResultGetPayload<{
  include: typeof enhancedForecastResultInclude;
}>;

export class EnhancedForecastResultRepository {
  public listByJobIdForOrganization(
    db: DbClient,
    input: { organizationId: string; forecastJobId: string },
  ): Promise<EnhancedForecastResultWithRelations[]> {
    return db.enhancedForecastResult.findMany({
      where: {
        organizationId: input.organizationId,
        forecastJobId: input.forecastJobId,
      },
      include: enhancedForecastResultInclude,
      orderBy: [{ forecastDate: "asc" }, { skuId: "asc" }, { id: "asc" }],
    });
  }

  public listByJobIdAndModelRegistryEntryId(
    db: DbClient,
    input: { organizationId: string; forecastJobId: string; modelRegistryEntryId: string },
  ): Promise<EnhancedForecastResultWithRelations[]> {
    return db.enhancedForecastResult.findMany({
      where: {
        organizationId: input.organizationId,
        forecastJobId: input.forecastJobId,
        modelRegistryEntryId: input.modelRegistryEntryId,
      },
      include: enhancedForecastResultInclude,
      orderBy: [{ forecastDate: "asc" }, { skuId: "asc" }, { id: "asc" }],
    });
  }

  public deleteByJobIdAndModelRegistryEntryId(
    db: DbClient,
    input: { forecastJobId: string; modelRegistryEntryId: string },
  ): Promise<void> {
    return db.enhancedForecastResult
      .deleteMany({
        where: {
          forecastJobId: input.forecastJobId,
          modelRegistryEntryId: input.modelRegistryEntryId,
        },
      })
      .then(() => undefined);
  }

  public createMany(
    db: DbClient,
    data: Prisma.EnhancedForecastResultCreateManyInput[],
  ): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.enhancedForecastResult.createMany({ data }).then(() => undefined);
  }
}
