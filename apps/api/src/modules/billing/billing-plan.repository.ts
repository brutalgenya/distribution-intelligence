import {
  BillingPlanStatus,
  type BillingPlan,
  type Prisma,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class BillingPlanRepository {
  public create(db: DbClient, data: Prisma.BillingPlanUncheckedCreateInput): Promise<BillingPlan> {
    return db.billingPlan.create({ data });
  }

  public upsertByCodeAndVersion(
    db: DbClient,
    input: {
      code: string;
      version: number;
      create: Prisma.BillingPlanUncheckedCreateInput;
      update: Prisma.BillingPlanUncheckedUpdateInput;
    },
  ): Promise<BillingPlan> {
    return db.billingPlan.upsert({
      where: {
        code_version: {
          code: input.code,
          version: input.version,
        },
      },
      create: input.create,
      update: input.update,
    });
  }

  public list(
    db: DbClient,
    input: { status?: BillingPlanStatus },
  ): Promise<BillingPlan[]> {
    return db.billingPlan.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
  }

  public findById(db: DbClient, id: string): Promise<BillingPlan | null> {
    return db.billingPlan.findUnique({
      where: { id },
    });
  }

  public findActiveByCode(db: DbClient, code: string): Promise<BillingPlan | null> {
    return db.billingPlan.findFirst({
      where: {
        code,
        status: BillingPlanStatus.active,
      },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    });
  }

  public findByStripePriceId(db: DbClient, stripePriceId: string): Promise<BillingPlan | null> {
    return db.billingPlan.findUnique({
      where: { stripePriceId },
    });
  }

  public findDefaultActivePlan(db: DbClient): Promise<BillingPlan | null> {
    return this.findActiveByCode(db, "starter");
  }
}
