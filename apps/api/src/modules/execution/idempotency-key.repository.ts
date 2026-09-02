import type { IdempotencyKey, IdempotencyKeyStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class IdempotencyKeyRepository {
  public create(db: DbClient, data: Prisma.IdempotencyKeyUncheckedCreateInput): Promise<IdempotencyKey> {
    return db.idempotencyKey.create({ data });
  }

  public findByKeyForOrganization(
    db: DbClient,
    input: { organizationId: string; key: string },
  ): Promise<IdempotencyKey | null> {
    return db.idempotencyKey.findUnique({
      where: {
        organizationId_key: {
          organizationId: input.organizationId,
          key: input.key,
        },
      },
    });
  }

  public updateById(
    db: DbClient,
    input: {
      id: string;
      data: { status?: IdempotencyKeyStatus; responseHash?: string | null };
    },
  ): Promise<IdempotencyKey> {
    return db.idempotencyKey.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
