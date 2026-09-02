import { randomUUID } from "node:crypto";

import { WorkerType } from "@prisma/client";

import { buildApp } from "../app.js";
import { runWithExecutionContext } from "../infrastructure/telemetry/execution-context.js";

const main = async (): Promise<void> => {
  const app = await buildApp();
  const correlationId = randomUUID();

  try {
    await runWithExecutionContext(
      {
        correlationId,
        workerType: WorkerType.execution,
      },
      async () => {
        const workerRun = await app.container.services.workerRunService.startRun(WorkerType.execution, {
          correlationId,
        });

        try {
          const processedCount = await app.container.services.executionProcessorService.processPendingTasks();
          await app.container.services.workerRunService.markSucceeded(workerRun.id, WorkerType.execution, {
            processedCount,
          });
          app.container.logger.info("Processed execution tasks.", { processedCount }, { workerType: WorkerType.execution });
        } catch (error) {
          await app.container.services.workerRunService.markFailed(workerRun.id, WorkerType.execution, {
            errorMessage: error instanceof Error ? error.message : "Execution worker failed.",
          });
          throw error;
        }
      },
    );
  } finally {
    await app.close();
  }
};

void main();
