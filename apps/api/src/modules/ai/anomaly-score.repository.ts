import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const anomalyScoreInclude = {
  modelRegistryEntry: true,
  aiRun: {
    include: {
      modelRegistryEntry: true,
    },
  },
} satisfies Prisma.AnomalyScoreInclude;

export type AnomalyScoreWithRelations = Prisma.AnomalyScoreGetPayload<{
  include: typeof anomalyScoreInclude;
}>;

export class AnomalyScoreRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<AnomalyScoreWithRelations | null> {
    return db.anomalyScore.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: anomalyScoreInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; subjectType?: string; subjectReference?: string },
  ): Promise<AnomalyScoreWithRelations[]> {
    return db.anomalyScore.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.subjectType ? { subjectType: input.subjectType } : {}),
        ...(input.subjectReference ? { subjectReference: input.subjectReference } : {}),
      },
      include: anomalyScoreInclude,
      orderBy: [{ measurementWindowEnd: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public findByScope(
    db: DbClient,
    input: {
      organizationId: string;
      modelRegistryEntryId: string;
      subjectType: string;
      subjectReference: string;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
    },
  ): Promise<AnomalyScoreWithRelations | null> {
    return db.anomalyScore.findUnique({
      where: {
        organizationId_modelRegistryEntryId_subjectType_subjectReference_measurementWindowStart_measurementWindowEnd:
          {
            organizationId: input.organizationId,
            modelRegistryEntryId: input.modelRegistryEntryId,
            subjectType: input.subjectType,
            subjectReference: input.subjectReference,
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
      },
      include: anomalyScoreInclude,
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      modelRegistryEntryId: string;
      subjectType: string;
      subjectReference: string;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
      create: Prisma.AnomalyScoreUncheckedCreateInput;
      update: Prisma.AnomalyScoreUncheckedUpdateInput;
    },
  ): Promise<AnomalyScoreWithRelations> {
    return db.anomalyScore.upsert({
      where: {
        organizationId_modelRegistryEntryId_subjectType_subjectReference_measurementWindowStart_measurementWindowEnd:
          {
            organizationId: input.organizationId,
            modelRegistryEntryId: input.modelRegistryEntryId,
            subjectType: input.subjectType,
            subjectReference: input.subjectReference,
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
      },
      create: input.create,
      update: input.update,
      include: anomalyScoreInclude,
    });
  }
}
