import { PrismaClient, type Prisma } from "@prisma/client";

import type { AppConfig } from "../config/env.js";
import { AppLogger } from "../logging/app-logger.js";
import { TelemetryService } from "../telemetry/telemetry.service.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

export const createPrismaClient = (config: AppConfig): PrismaClient =>
  new PrismaClient({
    log:
      config.NODE_ENV === "development"
        ? [{ emit: "event", level: "query" }, "warn", "error"]
        : [{ emit: "event", level: "query" }, "error"],
  });

export class PrismaTransactionRunner implements TransactionRunner {
  public constructor(private readonly prisma: PrismaClient) {}

  public run<T>(operation: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation);
  }
}

export const attachPrismaInstrumentation = (
  prisma: PrismaClient,
  telemetryService: TelemetryService,
  logger: AppLogger,
): void => {
  (
    prisma as unknown as {
      $on(event: "query", callback: (event: { duration: number; target: string }) => void): void;
    }
  ).$on("query", (event) => {
    telemetryService.recordDuration("db.operation.duration_ms", event.duration, {
      target: event.target,
    });

    if (event.duration >= 250) {
      logger.warn(
        "Slow database operation detected.",
        {
          target: event.target,
          durationMs: event.duration,
        },
        { module: "db", operation: "query" },
      );
    }
  });
};
