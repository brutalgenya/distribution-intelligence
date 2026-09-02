import type { AiRunStatus, AiRunType, ExecutionTaskStatus, ForecastJobStatus, Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

const executionTaskInclude = {
  attempts: {
    orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
  },
  decision: true,
} satisfies Prisma.ExecutionTaskInclude;

export type SupportExecutionTask = Prisma.ExecutionTaskGetPayload<{
  include: typeof executionTaskInclude;
}>;

export class SupportRepository {
  public listDecisions(
    db: DbClient,
    input: { organizationId: string; status?: string; from?: Date; to?: Date; limit: number },
  ) {
    return db.decision.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status as never } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: {
        reasons: true,
        scores: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listExecutionTasks(
    db: DbClient,
    input: {
      organizationId: string;
      status?: ExecutionTaskStatus;
      decisionId?: string;
      from?: Date;
      to?: Date;
      limit: number;
    },
  ): Promise<SupportExecutionTask[]> {
    return db.executionTask.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: executionTaskInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public getExecutionTask(
    db: DbClient,
    input: { organizationId: string; id: string },
  ): Promise<SupportExecutionTask | null> {
    return db.executionTask.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.id,
      },
      include: executionTaskInclude,
    });
  }

  public listExecutionAttempts(
    db: DbClient,
    input: { organizationId: string; executionTaskId: string },
  ) {
    return db.executionAttempt.findMany({
      where: {
        organizationId: input.organizationId,
        executionTaskId: input.executionTaskId,
      },
      orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
    });
  }

  public listForecastJobs(
    db: DbClient,
    input: {
      organizationId: string;
      status?: ForecastJobStatus;
      from?: Date;
      to?: Date;
      limit: number;
    },
  ) {
    return db.forecastJob.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listAiRuns(
    db: DbClient,
    input: {
      organizationId: string;
      status?: AiRunStatus;
      runType?: AiRunType;
      from?: Date;
      to?: Date;
      limit: number;
    },
  ) {
    return db.aiRun.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.runType ? { runType: input.runType } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: {
        modelRegistryEntry: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listAuditEvents(
    db: DbClient,
    input: {
      organizationId: string;
      correlationId?: string;
      from?: Date;
      to?: Date;
      limit: number;
    },
  ) {
    return db.auditEvent.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.correlationId ? { correlationId: input.correlationId } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listOutboxEvents(
    db: DbClient,
    input: {
      organizationId: string;
      aggregateId?: string;
      eventType?: string;
      from?: Date;
      to?: Date;
      limit: number;
    },
  ) {
    return db.outboxEvent.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.aggregateId ? { aggregateId: input.aggregateId } : {}),
        ...(input.eventType ? { eventType: input.eventType } : {}),
        ...(input.from || input.to
          ? {
              occurredAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listDecisionOutcomes(
    db: DbClient,
    input: {
      organizationId: string;
      decisionId?: string;
      from?: Date;
      to?: Date;
      limit: number;
    },
  ) {
    return db.decisionOutcome.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.decisionId ? { decisionId: input.decisionId } : {}),
        ...(input.from || input.to
          ? {
              computedAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: {
        decision: true,
        executionTask: true,
      },
      orderBy: [{ computedAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listFillRateMeasurements(
    db: DbClient,
    input: { organizationId: string; from?: Date; to?: Date; limit: number },
  ) {
    return db.fillRateMeasurement.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.from || input.to
          ? {
              measurementWindowEnd: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listForecastErrorMeasurements(
    db: DbClient,
    input: { organizationId: string; from?: Date; to?: Date; limit: number },
  ) {
    return db.forecastErrorMeasurement.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.from || input.to
          ? {
              measurementWindowEnd: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listPolicyEffectivenessSummaries(
    db: DbClient,
    input: { organizationId: string; from?: Date; to?: Date; limit: number },
  ) {
    return db.policyEffectivenessSummary.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.from || input.to
          ? {
              measurementWindowEnd: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: {
        policy: true,
      },
      orderBy: [{ measurementWindowEnd: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }

  public listStockoutIncidents(
    db: DbClient,
    input: { organizationId: string; from?: Date; to?: Date; limit: number },
  ) {
    return db.stockoutIncident.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.from || input.to
          ? {
              detectedAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      take: input.limit,
    });
  }
}
