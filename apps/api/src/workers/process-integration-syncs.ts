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
        workerType: WorkerType.integration,
      },
      async () => {
        const workerRun = await app.container.services.workerRunService.startRun(WorkerType.integration, {
          correlationId,
        });

        try {
          const processedCount = await app.container.services.integrationSyncService.processPendingSyncRuns();
          await app.container.services.workerRunService.markSucceeded(workerRun.id, WorkerType.integration, {
            processedCount,
          });
          app.container.logger.info("Processed integration sync runs.", { processedCount }, { workerType: WorkerType.integration });
        } catch (error) {
          await app.container.services.workerRunService.markFailed(workerRun.id, WorkerType.integration, {
            errorMessage: error instanceof Error ? error.message : "Integration worker failed.",
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
