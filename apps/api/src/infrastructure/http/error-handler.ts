import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import type { AppConfig } from "../config/env.js";
import { ApplicationError } from "../../shared/errors.js";
import { sanitizeForLogging } from "../logging/log-redaction.js";

export const registerErrorHandler = (app: FastifyInstance, config: AppConfig): void => {
  app.setErrorHandler((error, request, reply) => {
    const shouldExposeOperationalDetails = config.APP_ENV !== "production";

    app.container.services.telemetryService.incrementCounter("http.request.error", 1, {
      method: request.method,
      route: request.routeOptions.url,
    });

    if (error instanceof ZodError) {
      request.log.warn(
        {
          correlationId: request.requestContext?.correlationId ?? null,
          requestId: request.requestContext?.requestId ?? request.id,
          organizationId: request.requestContext?.activeOrganizationId ?? null,
          details: sanitizeForLogging(error.flatten()),
        },
        "Request validation failed.",
      );
      reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: error.flatten(),
        },
      });
      return;
    }

    if (error instanceof ApplicationError) {
      request.log.warn(
        {
          correlationId: request.requestContext?.correlationId ?? null,
          requestId: request.requestContext?.requestId ?? request.id,
          organizationId: request.requestContext?.activeOrganizationId ?? null,
          category: error.category,
          retryable: error.retryable,
          details: sanitizeForLogging(error.details),
        },
        "Application error handled.",
      );
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          category: error.category,
          retryable: error.retryable,
          ...(shouldExposeOperationalDetails && error.details !== undefined
            ? { details: sanitizeForLogging(error.details) }
            : {}),
        },
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const statusCode = error.code === "P2002" ? 409 : 400;
      request.log.error(
        {
          correlationId: request.requestContext?.correlationId ?? null,
          requestId: request.requestContext?.requestId ?? request.id,
          organizationId: request.requestContext?.activeOrganizationId ?? null,
          code: error.code,
          meta: sanitizeForLogging(error.meta),
        },
        "Persistence error handled.",
      );
      reply.status(statusCode).send({
        error: {
          code: "persistence_error",
          message:
            shouldExposeOperationalDetails || error.code === "P2002"
              ? error.message
              : "The request could not be completed.",
        },
      });
      return;
    }

    request.log.error(
      {
        correlationId: request.requestContext?.correlationId ?? null,
        requestId: request.requestContext?.requestId ?? request.id,
        organizationId: request.requestContext?.activeOrganizationId ?? null,
        err: sanitizeForLogging(error),
      },
      "Unhandled request error",
    );
    reply.status(500).send({
      error: {
        code: "internal_server_error",
        message: "An unexpected error occurred.",
      },
    });
  });
};
