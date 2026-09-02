import type {
  ExecutionTask,
  ExecutionTaskStatus,
  ExecutionTaskType,
  ExecutionTargetSystem,
  Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const executionTaskInclude = {
  attempts: {
    orderBy: [{ attemptNumber: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.ExecutionTaskInclude;

export type ExecutionTaskWithAttempts = Prisma.ExecutionTaskGetPayload<{
  include: typeof executionTaskInclude;
}>;

export class ExecutionTaskRepository {
  public create(db: DbClient, data: Prisma.ExecutionTaskUncheckedCreateInput): Promise<ExecutionTask> {
    return db.executionTask.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<ExecutionTaskWithAttempts | null> {
    return db.executionTask.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: executionTaskInclude,
    });
  }

  public findById(db: DbClient, id: string): Promise<ExecutionTaskWithAttempts | null> {
    return db.executionTask.findUnique({
      where: { id },
      include: executionTaskInclude,
    });
  }

  public findByDecisionAndType(
    db: DbClient,
    input: {
      decisionId: string;
      taskType: ExecutionTaskType;
      targetSystem: ExecutionTargetSystem;
    },
  ): Promise<ExecutionTaskWithAttempts | null> {
    return db.executionTask.findUnique({
      where: {
        decisionId_taskType_targetSystem: {
          decisionId: input.decisionId,
          taskType: input.taskType,
          targetSystem: input.targetSystem,
        },
      },
      include: executionTaskInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: ExecutionTaskStatus; decisionId?: string },
  ): Promise<ExecutionTaskWithAttempts[]> {
    return db.executionTask.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
      },
      include: executionTaskInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public findLatestSucceededByDecisionId(
    db: DbClient,
    input: { organizationId: string; decisionId: string },
  ): Promise<ExecutionTaskWithAttempts | null> {
    return db.executionTask.findFirst({
      where: {
        organizationId: input.organizationId,
        decisionId: input.decisionId,
        status: "succeeded",
      },
      include: executionTaskInclude,
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public async findNextRunnable(db: DbClient, now: Date): Promise<ExecutionTaskWithAttempts | null> {
    return db.executionTask.findFirst({
      where: {
        OR: [
          {
            status: "pending",
          },
          {
            status: "failed",
            nextRetryAt: {
              lte: now,
            },
          },
        ],
      },
      include: executionTaskInclude,
      orderBy: [{ nextRetryAt: "asc" }, { requestedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  }

  public async markRunningIfProcessable(
    db: DbClient,
    input: { id: string; startedAt: Date; now: Date },
  ): Promise<ExecutionTaskWithAttempts | null> {
    const result = await db.executionTask.updateMany({
      where: {
        id: input.id,
        OR: [
          {
            status: "pending",
          },
          {
            status: "failed",
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: input.now } }],
          },
        ],
      },
      data: {
        status: "running",
        startedAt: input.startedAt,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(db, input.id);
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.ExecutionTaskUncheckedUpdateInput },
  ): Promise<ExecutionTaskWithAttempts> {
    return db.executionTask.update({
      where: { id: input.id },
      data: input.data,
      include: executionTaskInclude,
    });
  }

  public countSucceededByOrganizationAndRequestedAtRange(
    db: DbClient,
    input: { organizationId: string; requestedAtGte: Date; requestedAtLt: Date },
  ): Promise<number> {
    return db.executionTask.count({
      where: {
        organizationId: input.organizationId,
        status: "succeeded",
        requestedAt: {
          gte: input.requestedAtGte,
          lt: input.requestedAtLt,
        },
      },
    });
  }
}
