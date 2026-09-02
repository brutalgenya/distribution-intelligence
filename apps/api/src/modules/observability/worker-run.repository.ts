import type { Prisma, WorkerRun, WorkerRunStatus, WorkerType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class WorkerRunRepository {
  public create(db: DbClient, data: Prisma.WorkerRunCreateInput): Promise<WorkerRun> {
    return db.workerRun.create({ data });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.WorkerRunUncheckedUpdateInput },
  ): Promise<WorkerRun> {
    return db.workerRun.update({
      where: { id: input.id },
      data: input.data,
    });
  }

  public findLatestByWorkerType(db: DbClient, workerType: WorkerType): Promise<WorkerRun | null> {
    return db.workerRun.findFirst({
      where: { workerType },
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public countByWorkerTypeAndStatus(
    db: DbClient,
    input: { workerType: WorkerType; status: WorkerRunStatus; createdAtGte?: Date },
  ): Promise<number> {
    return db.workerRun.count({
      where: {
        workerType: input.workerType,
        status: input.status,
        ...(input.createdAtGte ? { createdAt: { gte: input.createdAtGte } } : {}),
      },
    });
  }

  public sumProcessedCountByWorkerType(
    db: DbClient,
    input: { workerType: WorkerType; createdAtGte?: Date },
  ): Promise<{ _sum: { processedCount: number | null } }> {
    return db.workerRun.aggregate({
      where: {
        workerType: input.workerType,
        ...(input.createdAtGte ? { createdAt: { gte: input.createdAtGte } } : {}),
      },
      _sum: {
        processedCount: true,
      },
    });
  }

  public listRecent(db: DbClient, input: { workerType?: WorkerType; limit: number }): Promise<WorkerRun[]> {
    return db.workerRun.findMany({
      where: {
        ...(input.workerType ? { workerType: input.workerType } : {}),
      },
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }
}
