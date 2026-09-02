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
        workerType: WorkerType.forecast,
      },
      async () => {
        const workerRun = await app.container.services.workerRunService.startRun(WorkerType.forecast, {
          correlationId,
        });

        try {
          const processedCount = await app.container.services.forecastJobProcessorService.processPendingJobs();
          await app.container.services.workerRunService.markSucceeded(workerRun.id, WorkerType.forecast, {
            processedCount,
          });
          app.container.logger.info("Processed forecast jobs.", { processedCount }, { workerType: WorkerType.forecast });
        } catch (error) {
          await app.container.services.workerRunService.markFailed(workerRun.id, WorkerType.forecast, {
            errorMessage: error instanceof Error ? error.message : "Forecast worker failed.",
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
