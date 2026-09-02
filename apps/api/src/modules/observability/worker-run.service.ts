import { WorkerRunStatus, WorkerType, type Prisma, type WorkerRun } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { WorkerRunRepository } from "./worker-run.repository.js";

export class WorkerRunService {
  public constructor(
    private readonly db: DbClient,
    private readonly workerRunRepository: WorkerRunRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async startRun(
    workerType: WorkerType,
    input: { correlationId: string; metadata?: Prisma.InputJsonValue },
  ): Promise<WorkerRun> {
    const run = await this.workerRunRepository.create(this.db, {
      workerType,
      status: WorkerRunStatus.running,
      correlationId: input.correlationId,
      startedAt: new Date(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });

    this.telemetryService.incrementCounter("worker.run.started", 1, { workerType });
    this.logger.info("Worker run started.", { workerRunId: run.id }, { workerType, operation: "worker.start" });

    return run;
  }

  public async markSucceeded(
    workerRunId: string,
    workerType: WorkerType,
    input: { processedCount: number; metadata?: Prisma.InputJsonValue },
  ): Promise<WorkerRun> {
    const run = await this.workerRunRepository.updateById(this.db, {
      id: workerRunId,
      data: {
        status: WorkerRunStatus.succeeded,
        completedAt: new Date(),
        processedCount: input.processedCount,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        errorMessage: null,
      },
    });

    this.telemetryService.incrementCounter("worker.run.succeeded", 1, { workerType });
    this.logger.info(
      "Worker run succeeded.",
      { workerRunId: run.id, processedCount: input.processedCount },
      { workerType, operation: "worker.complete" },
    );

    return run;
  }

  public async markFailed(
    workerRunId: string,
    workerType: WorkerType,
    input: { errorMessage: string; processedCount?: number; metadata?: Prisma.InputJsonValue },
  ): Promise<WorkerRun> {
    const run = await this.workerRunRepository.updateById(this.db, {
      id: workerRunId,
      data: {
        status: WorkerRunStatus.failed,
        completedAt: new Date(),
        errorMessage: input.errorMessage.slice(0, 1000),
        ...(input.processedCount !== undefined ? { processedCount: input.processedCount } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });

    this.telemetryService.incrementCounter("worker.run.failed", 1, { workerType });
    this.logger.error(
      "Worker run failed.",
      { workerRunId: run.id, errorMessage: input.errorMessage, processedCount: input.processedCount ?? 0 },
      { workerType, operation: "worker.fail" },
    );

    return run;
  }
}
