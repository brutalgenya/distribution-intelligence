import type {
  ForecastJob,
  ForecastJobStatus,
  ForecastScopeType,
  Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class ForecastJobRepository {
  public create(db: DbClient, data: Prisma.ForecastJobUncheckedCreateInput): Promise<ForecastJob> {
    return db.forecastJob.create({ data });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: ForecastJobStatus },
  ): Promise<ForecastJob[]> {
    return db.forecastJob.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<ForecastJob | null> {
    return db.forecastJob.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public findById(db: DbClient, id: string): Promise<ForecastJob | null> {
    return db.forecastJob.findUnique({
      where: { id },
    });
  }

  public async findOldestPendingJob(db: DbClient): Promise<ForecastJob | null> {
    return db.forecastJob.findFirst({
      where: { status: "pending" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public findLatestCompletedSkuLocationJob(
    db: DbClient,
    input: { organizationId: string; skuId: string; locationId: string },
  ): Promise<ForecastJob | null> {
    return db.forecastJob.findFirst({
      where: {
        organizationId: input.organizationId,
        status: "completed" satisfies ForecastJobStatus,
        scopeType: "sku_location" satisfies ForecastScopeType,
        AND: [
          {
            scopeReference: {
              path: ["skuId"],
              equals: input.skuId,
            },
          },
          {
            scopeReference: {
              path: ["locationId"],
              equals: input.locationId,
            },
          },
        ],
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public findLatestCompletedSkuLocationJobBefore(
    db: DbClient,
    input: { organizationId: string; skuId: string; locationId: string; completedAtLte: Date },
  ): Promise<ForecastJob | null> {
    return db.forecastJob.findFirst({
      where: {
        organizationId: input.organizationId,
        status: "completed" satisfies ForecastJobStatus,
        scopeType: "sku_location" satisfies ForecastScopeType,
        completedAt: {
          lte: input.completedAtLte,
        },
        AND: [
          {
            scopeReference: {
              path: ["skuId"],
              equals: input.skuId,
            },
          },
          {
            scopeReference: {
              path: ["locationId"],
              equals: input.locationId,
            },
          },
        ],
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public async markRunningIfQueued(
    db: DbClient,
    input: { id: string; startedAt: Date },
  ): Promise<ForecastJob | null> {
    const result = await db.forecastJob.updateMany({
      where: {
        id: input.id,
        status: {
          in: ["pending", "failed"],
        },
      },
      data: {
        status: "running",
        startedAt: input.startedAt,
        completedAt: null,
        errorMessage: null,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(db, input.id);
  }

  public markCompleted(db: DbClient, input: { id: string; completedAt: Date }): Promise<ForecastJob> {
    return db.forecastJob.update({
      where: { id: input.id },
      data: {
        status: "completed",
        completedAt: input.completedAt,
        errorMessage: null,
      },
    });
  }

  public markFailed(
    db: DbClient,
    input: { id: string; completedAt: Date; errorMessage: string },
  ): Promise<ForecastJob> {
    return db.forecastJob.update({
      where: { id: input.id },
      data: {
        status: "failed",
        completedAt: input.completedAt,
        errorMessage: input.errorMessage,
      },
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.ForecastJobUncheckedUpdateInput },
  ): Promise<ForecastJob> {
    return db.forecastJob.update({
      where: { id: input.id },
      data: input.data,
    });
  }

  public countByOrganizationCreatedAtRange(
    db: DbClient,
    input: { organizationId: string; createdAtGte: Date; createdAtLt: Date },
  ): Promise<number> {
    return db.forecastJob.count({
      where: {
        organizationId: input.organizationId,
        createdAt: {
          gte: input.createdAtGte,
          lt: input.createdAtLt,
        },
      },
    });
  }
}
