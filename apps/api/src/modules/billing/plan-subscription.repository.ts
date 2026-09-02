import { type PlanSubscription, type Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const planSubscriptionInclude = {
  billingPlan: true,
} satisfies Prisma.PlanSubscriptionInclude;

export type PlanSubscriptionWithPlan = Prisma.PlanSubscriptionGetPayload<{
  include: typeof planSubscriptionInclude;
}>;

export class PlanSubscriptionRepository {
  public create(
    db: DbClient,
    data: Prisma.PlanSubscriptionUncheckedCreateInput,
  ): Promise<PlanSubscriptionWithPlan> {
    return db.planSubscription.create({
      data,
      include: planSubscriptionInclude,
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.PlanSubscriptionUncheckedUpdateInput },
  ): Promise<PlanSubscriptionWithPlan> {
    return db.planSubscription.update({
      where: { id: input.id },
      data: input.data,
      include: planSubscriptionInclude,
    });
  }

  public upsertByOrganization(
    db: DbClient,
    input: {
      organizationId: string;
      create: Prisma.PlanSubscriptionUncheckedCreateInput;
      update: Prisma.PlanSubscriptionUncheckedUpdateInput;
    },
  ): Promise<PlanSubscriptionWithPlan> {
    return db.planSubscription.upsert({
      where: {
        organizationId: input.organizationId,
      },
      create: input.create,
      update: input.update,
      include: planSubscriptionInclude,
    });
  }

  public findByOrganization(
    db: DbClient,
    organizationId: string,
  ): Promise<PlanSubscriptionWithPlan | null> {
    return db.planSubscription.findUnique({
      where: { organizationId },
      include: planSubscriptionInclude,
    });
  }

  public findByStripeCustomerId(
    db: DbClient,
    stripeCustomerId: string,
  ): Promise<PlanSubscriptionWithPlan | null> {
    return db.planSubscription.findUnique({
      where: { stripeCustomerId },
      include: planSubscriptionInclude,
    });
  }

  public findByStripeSubscriptionId(
    db: DbClient,
    stripeSubscriptionId: string,
  ): Promise<PlanSubscriptionWithPlan | null> {
    return db.planSubscription.findUnique({
      where: { stripeSubscriptionId },
      include: planSubscriptionInclude,
    });
  }

  public countByBillingPlanId(db: DbClient, billingPlanId: string): Promise<number> {
    return db.planSubscription.count({
      where: {
        billingPlanId,
      },
    });
  }
}
