import type { Prisma, StockoutIncident } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class StockoutIncidentRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<StockoutIncident | null> {
    return db.stockoutIncident.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; skuId?: string; locationId?: string },
  ): Promise<StockoutIncident[]> {
    return db.stockoutIncident.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
      orderBy: [{ incidentStartAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      skuId: string;
      locationId: string;
      incidentStartAt: Date;
      sourceType: string;
      create: Prisma.StockoutIncidentUncheckedCreateInput;
      update: Prisma.StockoutIncidentUncheckedUpdateInput;
    },
  ): Promise<StockoutIncident> {
    return db.stockoutIncident.upsert({
      where: {
        organizationId_skuId_locationId_incidentStartAt_sourceType: {
          organizationId: input.organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
          incidentStartAt: input.incidentStartAt,
          sourceType: input.sourceType,
        },
      },
      create: input.create,
      update: input.update,
    });
  }
}
