import type { OperatorOverride, OperatorOverrideType, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class OperatorOverrideRepository {
  public create(db: DbClient, data: Prisma.OperatorOverrideUncheckedCreateInput): Promise<OperatorOverride> {
    return db.operatorOverride.create({ data });
  }

  public listByOrganization(
    db: DbClient,
    input: {
      organizationId: string;
      decisionId?: string;
      executionTaskId?: string;
      overrideType?: OperatorOverrideType;
    },
  ): Promise<OperatorOverride[]> {
    return db.operatorOverride.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
        ...(input.executionTaskId ? { executionTaskId: input.executionTaskId } : {}),
        ...(input.overrideType ? { overrideType: input.overrideType } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
}
