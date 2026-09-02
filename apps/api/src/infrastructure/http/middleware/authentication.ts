import { randomUUID } from "node:crypto";

import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { setExecutionContext } from "../../telemetry/execution-context.js";
import { UnauthorizedError } from "../../../shared/errors.js";

const uuidHeaderSchema = z.string().uuid();

const publicHealthRoutes = new Set([
  "/healthz",
  "/observability/health",
  "/observability/live",
  "/observability/ready",
]);

const getSingleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const authenticationMiddleware = async (request: FastifyRequest): Promise<void> => {
  const rawCorrelationId = getSingleHeader(request.headers["x-correlation-id"]);
  const rawTraceId = getSingleHeader(request.headers["x-trace-id"]);

  const routePath = request.routeOptions.url ?? request.url.split("?", 1)[0];
  if (request.method === "GET" && publicHealthRoutes.has(routePath)) {
    return;
  }

  if (request.url.startsWith("/billing/webhooks/stripe")) {
    request.requestContext = {
      correlationId: rawCorrelationId ? uuidHeaderSchema.parse(rawCorrelationId) : randomUUID(),
      requestId: request.id,
      traceId: rawTraceId ? uuidHeaderSchema.parse(rawTraceId) : null,
      activeOrganizationId: null,
      user: {
        id: "00000000-0000-0000-0000-000000000000",
        email: "system.webhook@wholesale-ai.local",
        displayName: "System Webhook",
      },
    };

    setExecutionContext({
      correlationId: request.requestContext.correlationId,
      requestId: request.requestContext.requestId ?? null,
      traceId: request.requestContext.traceId ?? null,
      organizationId: null,
      userId: null,
    });

    return;
  }

  const rawUserId = getSingleHeader(request.headers["x-user-id"]);
  if (!rawUserId) {
    throw new UnauthorizedError("Missing x-user-id header.");
  }

  const userId = uuidHeaderSchema.parse(rawUserId);
  const rawOrganizationId = getSingleHeader(request.headers["x-organization-id"]);

  const user = await request.server.container.repositories.userRepository.findById(
    request.server.container.prisma,
    userId,
  );

  if (!user) {
    throw new UnauthorizedError("Authenticated user does not exist.");
  }

  request.requestContext = {
    correlationId: rawCorrelationId ? uuidHeaderSchema.parse(rawCorrelationId) : randomUUID(),
    requestId: request.id,
    traceId: rawTraceId ? uuidHeaderSchema.parse(rawTraceId) : null,
    activeOrganizationId: rawOrganizationId ? uuidHeaderSchema.parse(rawOrganizationId) : null,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  };

  setExecutionContext({
    correlationId: request.requestContext.correlationId,
    requestId: request.requestContext.requestId ?? null,
    traceId: request.requestContext.traceId ?? null,
    organizationId: request.requestContext.activeOrganizationId,
    userId: request.requestContext.user.id,
  });
};
