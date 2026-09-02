import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface CreateAuditEventInput {
  organizationId: string | null;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Prisma.InputJsonValue;
  correlationId: string;
}

export class AuditEventRepository {
  public create(db: DbClient, input: CreateAuditEventInput): Promise<void> {
    return db.auditEvent
      .create({
        data: input,
      })
      .then(() => undefined);
  }
}
