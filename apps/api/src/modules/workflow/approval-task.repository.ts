import { ApprovalTaskStatus, type ApprovalTask, type ApprovalTaskPurpose, type Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class ApprovalTaskRepository {
  public create(db: DbClient, data: Prisma.ApprovalTaskUncheckedCreateInput): Promise<ApprovalTask> {
    return db.approvalTask.create({ data });
  }

  public findByIdForOrganization(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<ApprovalTask | null> {
    return db.approvalTask.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
    });
  }

  public findPendingByDecision(
    db: DbClient,
    input: { organizationId: string; decisionId: string; purpose?: ApprovalTaskPurpose },
  ): Promise<ApprovalTask | null> {
    return db.approvalTask.findFirst({
      where: {
        organizationId: input.organizationId,
        decisionId: input.decisionId,
        status: ApprovalTaskStatus.pending,
        ...(input.purpose ? { purpose: input.purpose } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public listByOrganization(
    db: DbClient,
    input: { organizationId: string; status?: ApprovalTaskStatus; decisionId?: string },
  ): Promise<ApprovalTask[]> {
    return db.approvalTask.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.ApprovalTaskUncheckedUpdateInput },
  ): Promise<ApprovalTask> {
    return db.approvalTask.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
