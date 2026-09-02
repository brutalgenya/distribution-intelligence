import type { Prisma, SupplierSku } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class SupplierSkuRepository {
  public create(db: DbClient, data: Prisma.SupplierSkuUncheckedCreateInput): Promise<SupplierSku> {
    return db.supplierSku.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<SupplierSku | null> {
    return db.supplierSku.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; supplierId?: string; skuId?: string; isPrimary?: boolean },
  ): Promise<SupplierSku[]> {
    return db.supplierSku.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  public findPrimaryBySku(
    db: DbClient,
    input: { organizationId: string; skuId: string },
  ): Promise<SupplierSku | null> {
    return db.supplierSku.findFirst({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        isPrimary: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  public clearPrimaryForSku(
    db: DbClient,
    input: { organizationId: string; skuId: string; exceptId?: string },
  ): Promise<void> {
    return db.supplierSku
      .updateMany({
        where: {
          organizationId: input.organizationId,
          skuId: input.skuId,
          isPrimary: true,
          ...(input.exceptId ? { NOT: { id: input.exceptId } } : {}),
        },
        data: {
          isPrimary: false,
        },
      })
      .then(() => undefined);
  }

  public updateForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string; data: Prisma.SupplierSkuUncheckedUpdateInput },
  ): Promise<SupplierSku> {
    return db.supplierSku.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
