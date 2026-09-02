import type { Entitlement, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface CreateEntitlementInput {
  key: string;
  value: Prisma.InputJsonValue;
}

export class EntitlementRepository {
  public createMany(
    db: DbClient,
    organizationId: string,
    entitlements: CreateEntitlementInput[],
  ): Promise<void> {
    return db.entitlement
      .createMany({
        data: entitlements.map((entitlement) => ({
          organizationId,
          key: entitlement.key,
          value: entitlement.value,
        })),
        skipDuplicates: true,
      })
      .then(() => undefined);
  }

  public listByOrganization(db: DbClient, organizationId: string): Promise<Entitlement[]> {
    return db.entitlement.findMany({
      where: { organizationId },
      orderBy: [{ key: "asc" }, { createdAt: "asc" }],
    });
  }
}
