import type {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationType,
  Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class IntegrationConnectionRepository {
  public create(
    db: DbClient,
    data: Prisma.IntegrationConnectionUncheckedCreateInput,
  ): Promise<IntegrationConnection> {
    return db.integrationConnection.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<IntegrationConnection | null> {
    return db.integrationConnection.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public findById(db: DbClient, id: string): Promise<IntegrationConnection | null> {
    return db.integrationConnection.findUnique({
      where: { id },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; integrationType?: IntegrationType; status?: IntegrationConnectionStatus },
  ): Promise<IntegrationConnection[]> {
    return db.integrationConnection.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.integrationType ? { integrationType: input.integrationType } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.IntegrationConnectionUncheckedUpdateInput },
  ): Promise<IntegrationConnection> {
    return db.integrationConnection.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
