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
        workerType: WorkerType.outcomes,
      },
      async () => {
        const workerRun = await app.container.services.workerRunService.startRun(WorkerType.outcomes, {
          correlationId,
        });

        try {
          const summary = await app.container.services.outcomesProcessingService.processRecentWindow();
          const processedCount =
            summary.stockoutCount +
            summary.fillRateCount +
            summary.forecastErrorCount +
            summary.decisionOutcomeCount +
            summary.policySummaryCount;

          await app.container.services.workerRunService.markSucceeded(workerRun.id, WorkerType.outcomes, {
            processedCount,
            metadata: { ...summary },
          });
          app.container.logger.info("Processed outcome measurements.", summary, { workerType: WorkerType.outcomes });
        } catch (error) {
          await app.container.services.workerRunService.markFailed(workerRun.id, WorkerType.outcomes, {
            errorMessage: error instanceof Error ? error.message : "Outcomes worker failed.",
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
