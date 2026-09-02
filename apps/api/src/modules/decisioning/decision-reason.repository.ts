import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class DecisionReasonRepository {
  public createMany(db: DbClient, data: Prisma.DecisionReasonCreateManyInput[]): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.decisionReason.createMany({ data }).then(() => undefined);
  }
}
