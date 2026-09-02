import type { DecisionOutcome, DecisionOutcomeStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class DecisionOutcomeRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<DecisionOutcome | null> {
    return db.decisionOutcome.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; decisionId?: string; outcomeStatus?: DecisionOutcomeStatus },
  ): Promise<DecisionOutcome[]> {
    return db.decisionOutcome.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
        ...(input.outcomeStatus ? { outcomeStatus: input.outcomeStatus } : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      decisionId: string;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
      create: Prisma.DecisionOutcomeUncheckedCreateInput;
      update: Prisma.DecisionOutcomeUncheckedUpdateInput;
    },
  ): Promise<DecisionOutcome> {
    return db.decisionOutcome.upsert({
      where: {
        organizationId_decisionId_measurementWindowStart_measurementWindowEnd: {
          organizationId: input.organizationId,
          decisionId: input.decisionId,
          measurementWindowStart: input.measurementWindowStart,
          measurementWindowEnd: input.measurementWindowEnd,
        },
      },
      create: input.create,
      update: input.update,
    });
  }
}
