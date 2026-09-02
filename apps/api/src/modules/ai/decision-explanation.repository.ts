import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const decisionExplanationInclude = {
  modelRegistryEntry: true,
  aiRun: {
    include: {
      modelRegistryEntry: true,
    },
  },
} satisfies Prisma.DecisionExplanationInclude;

export type DecisionExplanationWithRelations = Prisma.DecisionExplanationGetPayload<{
  include: typeof decisionExplanationInclude;
}>;

export class DecisionExplanationRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<DecisionExplanationWithRelations | null> {
    return db.decisionExplanation.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: decisionExplanationInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; decisionId?: string },
  ): Promise<DecisionExplanationWithRelations[]> {
    return db.decisionExplanation.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
      },
      include: decisionExplanationInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
  }

  public findByDecisionAndModel(
    db: DbClient,
    input: { organizationId: string; decisionId: string; modelRegistryEntryId: string },
  ): Promise<DecisionExplanationWithRelations | null> {
    return db.decisionExplanation.findUnique({
      where: {
        organizationId_decisionId_modelRegistryEntryId: {
          organizationId: input.organizationId,
          decisionId: input.decisionId,
          modelRegistryEntryId: input.modelRegistryEntryId,
        },
      },
      include: decisionExplanationInclude,
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      decisionId: string;
      modelRegistryEntryId: string;
      create: Prisma.DecisionExplanationUncheckedCreateInput;
      update: Prisma.DecisionExplanationUncheckedUpdateInput;
    },
  ): Promise<DecisionExplanationWithRelations> {
    return db.decisionExplanation.upsert({
      where: {
        organizationId_decisionId_modelRegistryEntryId: {
          organizationId: input.organizationId,
          decisionId: input.decisionId,
          modelRegistryEntryId: input.modelRegistryEntryId,
        },
      },
      create: input.create,
      update: input.update,
      include: decisionExplanationInclude,
    });
  }
}
