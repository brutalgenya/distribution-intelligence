import type {
  IntegrationDirection,
  IntegrationSyncRun,
  IntegrationSyncStatus,
  IntegrationSyncType,
  Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const integrationSyncRunInclude = {
  integrationConnection: true,
  requestedByUser: true,
} satisfies Prisma.IntegrationSyncRunInclude;

export type IntegrationSyncRunWithConnection = Prisma.IntegrationSyncRunGetPayload<{
  include: typeof integrationSyncRunInclude;
}>;

export class IntegrationSyncRunRepository {
  public create(
    db: DbClient,
    data: Prisma.IntegrationSyncRunUncheckedCreateInput,
  ): Promise<IntegrationSyncRun> {
    return db.integrationSyncRun.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<IntegrationSyncRunWithConnection | null> {
    return db.integrationSyncRun.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: integrationSyncRunInclude,
    });
  }

  public findById(db: DbClient, id: string): Promise<IntegrationSyncRunWithConnection | null> {
    return db.integrationSyncRun.findUnique({
      where: { id },
      include: integrationSyncRunInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: {
      organizationId: string;
      integrationConnectionId?: string;
      direction?: IntegrationDirection;
      syncType?: IntegrationSyncType;
      status?: IntegrationSyncStatus;
    },
  ): Promise<IntegrationSyncRun[]> {
    return db.integrationSyncRun.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.integrationConnectionId ? { integrationConnectionId: input.integrationConnectionId } : {}),
        ...(input.direction ? { direction: input.direction } : {}),
        ...(input.syncType ? { syncType: input.syncType } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public listPendingInboundRuns(db: DbClient, limit = 20): Promise<IntegrationSyncRunWithConnection[]> {
    return db.integrationSyncRun.findMany({
      where: {
        direction: "inbound",
        status: "pending",
      },
      include: integrationSyncRunInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.IntegrationSyncRunUncheckedUpdateInput },
  ): Promise<IntegrationSyncRun> {
    return db.integrationSyncRun.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
