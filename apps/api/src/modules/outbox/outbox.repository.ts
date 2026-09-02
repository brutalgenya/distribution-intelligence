import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface CreateOutboxEventInput {
  organizationId: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.InputJsonValue;
  occurredAt?: Date;
}

export class OutboxEventRepository {
  public create(db: DbClient, input: CreateOutboxEventInput): Promise<void> {
    return db.outboxEvent
      .create({
        data: {
          organizationId: input.organizationId,
          eventType: input.eventType,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          payload: input.payload,
          ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
        },
      })
      .then(() => undefined);
  }
}
