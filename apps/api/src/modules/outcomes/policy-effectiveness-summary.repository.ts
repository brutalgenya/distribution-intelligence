import type { OutcomeScopeType, PolicyEffectivenessSummary, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class PolicyEffectivenessSummaryRepository {
  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<PolicyEffectivenessSummary | null> {
    return db.policyEffectivenessSummary.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; policyId?: string },
  ): Promise<PolicyEffectivenessSummary[]> {
    return db.policyEffectivenessSummary.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.policyId ? { policyId: input.policyId } : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      policyId: string;
      policyVersion: number;
      scopeType: OutcomeScopeType;
      measurementWindowStart: Date;
      measurementWindowEnd: Date;
      create: Prisma.PolicyEffectivenessSummaryUncheckedCreateInput;
      update: Prisma.PolicyEffectivenessSummaryUncheckedUpdateInput;
    },
  ): Promise<PolicyEffectivenessSummary> {
    return db.policyEffectivenessSummary.upsert({
      where: {
        organizationId_policyId_policyVersion_scopeType_measurementWindowStart_measurementWindowEnd:
          {
            organizationId: input.organizationId,
            policyId: input.policyId,
            policyVersion: input.policyVersion,
            scopeType: input.scopeType,
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
      },
      create: input.create,
      update: input.update,
    });
  }
}
