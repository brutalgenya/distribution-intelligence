import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class DecisionArtifactRepository {
  public createMany(db: DbClient, data: Prisma.DecisionArtifactCreateManyInput[]): Promise<void> {
    if (data.length === 0) {
      return Promise.resolve();
    }

    return db.decisionArtifact.createMany({ data }).then(() => undefined);
  }
}
