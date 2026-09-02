import type { Logger as PinoLogger } from "pino";

import { getExecutionContext, type ExecutionContext } from "../telemetry/execution-context.js";
import { sanitizeForLogging } from "./log-redaction.js";

export interface LogContext extends ExecutionContext {
  organizationId?: string | null;
  userId?: string | null;
  module?: string;
  operation?: string;
  decisionId?: string | null;
  executionTaskId?: string | null;
  forecastJobId?: string | null;
  aiRunId?: string | null;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const mergeLogContext = (baseContext: LogContext, context?: LogContext): LogContext => ({
  ...getExecutionContext(),
  ...baseContext,
  ...(context ?? {}),
});

export class AppLogger {
  public constructor(
    private readonly logger: PinoLogger,
    private readonly baseContext: LogContext = {},
  ) {}

  public child(context: LogContext): AppLogger {
    return new AppLogger(this.logger, {
      ...this.baseContext,
      ...context,
    });
  }

  public debug(message: string, metadata?: unknown, context?: LogContext): void {
    this.write("debug", message, metadata, context);
  }

  public info(message: string, metadata?: unknown, context?: LogContext): void {
    this.write("info", message, metadata, context);
  }

  public warn(message: string, metadata?: unknown, context?: LogContext): void {
    this.write("warn", message, metadata, context);
  }

  public error(message: string, metadata?: unknown, context?: LogContext): void {
    this.write("error", message, metadata, context);
  }

  private write(level: LogLevel, message: string, metadata?: unknown, context?: LogContext): void {
    const payload = {
      ...mergeLogContext(this.baseContext, context),
      ...(metadata !== undefined ? { metadata: sanitizeForLogging(metadata) } : {}),
    };

    this.logger[level](payload, message);
  }
}
