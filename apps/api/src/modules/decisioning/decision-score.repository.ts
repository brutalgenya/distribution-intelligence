import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class DecisionScoreRepository {
  public createMany(db: DbClient, data: Prisma.DecisionScoreCreateManyInput[]): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.decisionScore.createMany({ data }).then(() => undefined);
  }
}
