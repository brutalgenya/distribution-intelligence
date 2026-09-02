import pino, { stdTimeFunctions, type LoggerOptions } from "pino";

import type { AppConfig } from "../config/env.js";
import { sanitizeForLogging } from "./log-redaction.js";

export const buildLoggerOptions = (config: AppConfig): LoggerOptions => ({
  level: config.LOG_LEVEL,
  timestamp: stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-api-key",
      "request.headers.authorization",
      "request.headers.x-api-key",
      "request.headers.cookie",
      "request.headers.stripe-signature",
      "headers.authorization",
      "headers.x-api-key",
      "headers.cookie",
      "headers.stripe-signature",
      "*.authorization",
      "*.password",
      "*.secret",
      "*.token",
      "*.apiKey",
      "*.api_key",
      "*.signature",
      "*.client_secret",
      "*.cookie",
    ],
    remove: false,
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: (error) => sanitizeForLogging(error),
  },
});

export const createAppLogger = (config: AppConfig) => pino(buildLoggerOptions(config));
