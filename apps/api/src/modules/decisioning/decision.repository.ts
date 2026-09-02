import type { Decision, DecisionStatus, DecisionType, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const decisionInclude = {
  reasons: true,
  scores: true,
  artifacts: true,
} satisfies Prisma.DecisionInclude;

export type DecisionWithDetails = Prisma.DecisionGetPayload<{
  include: typeof decisionInclude;
}>;

export class DecisionRepository {
  public create(db: DbClient, data: Prisma.DecisionUncheckedCreateInput): Promise<Decision> {
    return db.decision.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<DecisionWithDetails | null> {
    return db.decision.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: decisionInclude,
    });
  }

  public listByOrganization(
    db: DbClient,
    input: {
      organizationId: string;
      decisionType?: DecisionType;
      status?: DecisionStatus;
      skuId?: string;
      locationId?: string;
    },
  ): Promise<DecisionWithDetails[]> {
    return db.decision.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.decisionType ? { decisionType: input.decisionType } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
      include: decisionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public listBySku(
    db: DbClient,
    input: { organizationId: string; skuId: string; decisionType?: DecisionType },
  ): Promise<DecisionWithDetails[]> {
    return db.decision.findMany({
      where: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        ...(input.decisionType ? { decisionType: input.decisionType } : {}),
      },
      include: decisionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public listProposedByScope(
    db: DbClient,
    input: {
      organizationId: string;
      decisionType: DecisionType;
      policyId: string;
      skuId: string | null;
      locationId: string | null;
      supplierId: string | null;
    },
  ): Promise<DecisionWithDetails[]> {
    return db.decision.findMany({
      where: {
        organizationId: input.organizationId,
        decisionType: input.decisionType,
        policyId: input.policyId,
        status: "proposed",
        skuId: input.skuId,
        locationId: input.locationId,
        supplierId: input.supplierId,
      },
      include: decisionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public updateStatusById(
    db: DbClient,
    input: { id: string; status: DecisionStatus },
  ): Promise<DecisionWithDetails> {
    return db.decision.update({
      where: { id: input.id },
      data: { status: input.status },
      include: decisionInclude,
    });
  }
}
