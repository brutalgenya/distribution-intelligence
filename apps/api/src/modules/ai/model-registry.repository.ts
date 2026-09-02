import type { AiModelType, ModelRegistryEntry, ModelRegistryStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class ModelRegistryRepository {
  public create(db: DbClient, data: Prisma.ModelRegistryEntryUncheckedCreateInput): Promise<ModelRegistryEntry> {
    return db.modelRegistryEntry.create({ data });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.ModelRegistryEntryUncheckedUpdateInput },
  ): Promise<ModelRegistryEntry> {
    return db.modelRegistryEntry.update({
      where: { id: input.id },
      data: input.data,
    });
  }

  public findById(db: DbClient, id: string): Promise<ModelRegistryEntry | null> {
    return db.modelRegistryEntry.findUnique({
      where: { id },
    });
  }

  public list(
    db: DbClient,
    filters: { modelType?: AiModelType; status?: ModelRegistryStatus },
  ): Promise<ModelRegistryEntry[]> {
    return db.modelRegistryEntry.findMany({
      where: {
        ...(filters.modelType ? { modelType: filters.modelType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ modelType: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
    });
  }

  public findActiveByType(db: DbClient, modelType: AiModelType): Promise<ModelRegistryEntry | null> {
    return db.modelRegistryEntry.findFirst({
      where: {
        modelType,
        status: "active",
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
  }

  public deactivateActiveByType(
    db: DbClient,
    input: { modelType: AiModelType; excludeId?: string },
  ): Promise<void> {
    return db.modelRegistryEntry
      .updateMany({
        where: {
          modelType: input.modelType,
          status: "active",
          ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
        },
        data: {
          status: "inactive",
        },
      })
      .then(() => undefined);
  }
}
