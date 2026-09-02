import type { IntegrationFailedRecord, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class IntegrationFailedRecordRepository {
  public create(
    db: DbClient,
    data: Prisma.IntegrationFailedRecordUncheckedCreateInput,
  ): Promise<IntegrationFailedRecord> {
    return db.integrationFailedRecord.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<IntegrationFailedRecord | null> {
    return db.integrationFailedRecord.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; integrationConnectionId?: string; syncRunId?: string; resolved?: boolean },
  ): Promise<IntegrationFailedRecord[]> {
    return db.integrationFailedRecord.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.integrationConnectionId ? { integrationConnectionId: input.integrationConnectionId } : {}),
        ...(input.syncRunId ? { syncRunId: input.syncRunId } : {}),
        ...(input.resolved === true
          ? { resolvedAt: { not: null } }
          : input.resolved === false
            ? { resolvedAt: null }
            : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
}
