import type { Prisma, Sku, SkuStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export interface ListSkusInput {
  organizationId: string;
  status?: SkuStatus;
}

export class SkuRepository {
  public create(db: DbClient, data: Prisma.SkuUncheckedCreateInput): Promise<Sku> {
    return db.sku.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<Sku | null> {
    return db.sku.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public findByCodeForOrganization(
    db: DbClient,
    input: { organizationId: string; skuCode: string },
  ): Promise<Sku | null> {
    return db.sku.findFirst({
      where: {
        organizationId: input.organizationId,
        skuCode: input.skuCode,
      },
    });
  }

  public listByIdsForOrganization(
    db: DbClient,
    input: { organizationId: string; ids: string[] },
  ): Promise<Sku[]> {
    if (input.ids.length === 0) {
      return Promise.resolve([]);
    }

    return db.sku.findMany({
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
    input: { organizationId: string; skuCodes: string[] },
  ): Promise<Sku[]> {
    if (input.skuCodes.length === 0) {
      return Promise.resolve([]);
    }

    return db.sku.findMany({
      where: {
        organizationId: input.organizationId,
        skuCode: {
          in: input.skuCodes,
        },
      },
    });
  }

  public listByOrganization(db: DbClient, input: ListSkusInput): Promise<Sku[]> {
    return db.sku.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public countByOrganization(db: DbClient, organizationId: string): Promise<number> {
    return db.sku.count({
      where: { organizationId },
    });
  }

  public updateForOrganization(
    db: DbClient,
    input: {
      organizationId: string;
      id: string;
      data: Prisma.SkuUncheckedUpdateInput;
    },
  ): Promise<Sku> {
    return db.sku.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
