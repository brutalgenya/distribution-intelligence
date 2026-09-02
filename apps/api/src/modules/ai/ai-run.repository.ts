import type { AiRunStatus, AiRunType, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const aiRunInclude = {
  modelRegistryEntry: true,
} satisfies Prisma.AiRunInclude;

export type AiRunWithModel = Prisma.AiRunGetPayload<{
  include: typeof aiRunInclude;
}>;

export class AiRunRepository {
  public create(db: DbClient, data: Prisma.AiRunUncheckedCreateInput): Promise<AiRunWithModel> {
    return db.aiRun.create({
      data,
      include: aiRunInclude,
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.AiRunUncheckedUpdateInput },
  ): Promise<AiRunWithModel> {
    return db.aiRun.update({
      where: { id: input.id },
      data: input.data,
      include: aiRunInclude,
    });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<AiRunWithModel | null> {
    return db.aiRun.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: aiRunInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; runType?: AiRunType; status?: AiRunStatus },
  ): Promise<AiRunWithModel[]> {
    return db.aiRun.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.runType ? { runType: input.runType } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: aiRunInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public countByOrganizationCreatedAtRange(
    db: DbClient,
    input: { organizationId: string; createdAtGte: Date; createdAtLt: Date },
  ): Promise<number> {
    return db.aiRun.count({
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
