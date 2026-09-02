import type { Policy, PolicyStatus, PolicyType, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class PolicyRepository {
  public create(db: DbClient, data: Prisma.PolicyUncheckedCreateInput): Promise<Policy> {
    return db.policy.create({ data });
  }

  public findByIdForOrganization(db: DbClient, input: { organizationId: string; id: string }): Promise<Policy | null> {
    return db.policy.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public findActiveByType(
    db: DbClient,
    input: { organizationId: string; policyType: PolicyType },
  ): Promise<Policy | null> {
    return db.policy.findFirst({
      where: {
        organizationId: input.organizationId,
        policyType: input.policyType,
        status: "active",
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; policyType?: PolicyType; status?: PolicyStatus },
  ): Promise<Policy[]> {
    return db.policy.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.policyType ? { policyType: input.policyType } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ policyType: "asc" }, { version: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    });
  }

  public listActiveByType(
    db: DbClient,
    input: { organizationId: string; policyType: PolicyType },
  ): Promise<Policy[]> {
    return db.policy.findMany({
      where: {
        organizationId: input.organizationId,
        policyType: input.policyType,
        status: "active",
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  public updateForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string; data: Prisma.PolicyUncheckedUpdateInput },
  ): Promise<Policy> {
    return db.policy.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
