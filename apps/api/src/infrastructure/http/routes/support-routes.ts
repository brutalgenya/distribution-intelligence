import type { FastifyInstance } from "fastify";

import {
  supportAiRunListQuerySchema,
  supportEntityIdParamsSchema,
  supportExecutionListQuerySchema,
  supportForecastJobListQuerySchema,
  supportListQuerySchema,
  supportOutcomeRecomputeBodySchema,
  supportOutboxQuerySchema,
  supportOutcomesQuerySchema,
  supportRequeueBodySchema,
  supportTimelineQuerySchema,
} from "../../../modules/support/support.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerSupportRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (supportApp) => {
    supportApp.addHook("preHandler", activeOrganizationMiddleware);

    supportApp.get("/support/decisions", async (request) => {
      const query = supportListQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listDecisions(request.requestContext, {
        limit: query.limit,
        ...(query.status ? { status: query.status } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/executions", async (request) => {
      const query = supportExecutionListQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listExecutions(request.requestContext, {
        limit: query.limit,
        ...(query.status ? { status: query.status } : {}),
        ...(query.decisionId ? { decisionId: query.decisionId } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/executions/:id", async (request) => {
      const params = supportEntityIdParamsSchema.parse(request.params);
      return request.server.container.services.supportService.getExecution(request.requestContext, params.id);
    });

    supportApp.get("/support/executions/:id/attempts", async (request) => {
      const params = supportEntityIdParamsSchema.parse(request.params);
      return request.server.container.services.supportService.listExecutionAttempts(request.requestContext, params.id);
    });

    supportApp.get("/support/forecast-jobs", async (request) => {
      const query = supportForecastJobListQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listForecastJobs(request.requestContext, {
        limit: query.limit,
        ...(query.status ? { status: query.status } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/ai-runs", async (request) => {
      const query = supportAiRunListQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listAiRuns(request.requestContext, {
        limit: query.limit,
        ...(query.status ? { status: query.status } : {}),
        ...(query.runType ? { runType: query.runType } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/audit-timeline", async (request) => {
      const query = supportTimelineQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listAuditTimeline(request.requestContext, {
        limit: query.limit,
        ...(query.decisionId ? { decisionId: query.decisionId } : {}),
        ...(query.executionTaskId ? { executionTaskId: query.executionTaskId } : {}),
        ...(query.correlationId ? { correlationId: query.correlationId } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/outbox-events", async (request) => {
      const query = supportOutboxQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listOutboxEvents(request.requestContext, {
        limit: query.limit,
        ...(query.aggregateId ? { aggregateId: query.aggregateId } : {}),
        ...(query.eventType ? { eventType: query.eventType } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/outcomes", async (request) => {
      const query = supportOutcomesQuerySchema.parse(request.query);
      return request.server.container.services.supportService.listOutcomes(request.requestContext, {
        limit: query.limit,
        ...(query.decisionId ? { decisionId: query.decisionId } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
      });
    });

    supportApp.get("/support/worker-status", async (request) =>
      request.server.container.services.observabilityService.getWorkerStatus(request.requestContext),
    );

    supportApp.post("/support/executions/:id/requeue", async (request) => {
      const params = supportEntityIdParamsSchema.parse(request.params);
      const body = supportRequeueBodySchema.parse(request.body);
      return request.server.container.services.supportService.requeueExecutionTask(
        request.requestContext,
        params.id,
        {
          ...(body.reason ? { reason: body.reason } : {}),
        },
      );
    });

    supportApp.post("/support/forecast-jobs/:id/requeue", async (request) => {
      const params = supportEntityIdParamsSchema.parse(request.params);
      const body = supportRequeueBodySchema.parse(request.body);
      return request.server.container.services.supportService.requeueForecastJob(
        request.requestContext,
        params.id,
        {
          ...(body.reason ? { reason: body.reason } : {}),
        },
      );
    });

    supportApp.post("/support/outcomes/recompute", async (request) => {
      const body = supportOutcomeRecomputeBodySchema.parse(request.body);
      return request.server.container.services.supportService.recomputeOutcomes(request.requestContext, body);
    });
  });
};
