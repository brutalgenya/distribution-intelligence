import type { ExecutionAttempt, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export type ExecutionAttemptWithTask = Prisma.ExecutionAttemptGetPayload<{}>;

export class ExecutionAttemptRepository {
  public create(db: DbClient, data: Prisma.ExecutionAttemptUncheckedCreateInput): Promise<ExecutionAttempt> {
    return db.executionAttempt.create({ data });
  }

  public findLatestByTaskId(db: DbClient, executionTaskId: string): Promise<ExecutionAttempt | null> {
    return db.executionAttempt.findFirst({
      where: { executionTaskId },
      orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
    });
  }

  public updateById(
    db: DbClient,
    input: { id: string; data: Prisma.ExecutionAttemptUncheckedUpdateInput },
  ): Promise<ExecutionAttempt> {
    return db.executionAttempt.update({
      where: { id: input.id },
      data: input.data,
    });
  }
}
