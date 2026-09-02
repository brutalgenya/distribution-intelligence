import type { Location, LocationStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface ListLocationsInput {
  organizationId: string;
  status?: LocationStatus;
}

export class LocationRepository {
  public create(db: DbClient, data: Prisma.LocationUncheckedCreateInput): Promise<Location> {
    return db.location.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<Location | null> {
    return db.location.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public findByCodeForOrganization(
    db: DbClient,
    input: { organizationId: string; code: string },
  ): Promise<Location | null> {
    return db.location.findFirst({
      where: {
        organizationId: input.organizationId,
        code: input.code,
      },
    });
  }

  public listByIdsForOrganization(
    db: DbClient,
    input: { organizationId: string; ids: string[] },
  ): Promise<Location[]> {
    if (input.ids.length === 0) {
      return Promise.resolve([]);
    }

    return db.location.findMany({
      where: {
        organizationId: input.organizationId,
        id: {
          in: input.ids,
        },
      },
    });
  }

  public listByCodesForOrganization(
    db: DbClient,
    input: { organizationId: string; codes: string[] },
  ): Promise<Location[]> {
    if (input.codes.length === 0) {
      return Promise.resolve([]);
    }

    return db.location.findMany({
      where: {
        organizationId: input.organizationId,
        code: {
          in: input.codes,
        },
      },
    });
  }

  public listByOrganization(db: DbClient, input: ListLocationsInput): Promise<Location[]> {
    return db.location.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.LocationUncheckedUpdateInput },
  ): Promise<Location> {
    return db.location.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
