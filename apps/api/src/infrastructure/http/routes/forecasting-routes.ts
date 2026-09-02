import type { FastifyInstance } from "fastify";

import {
  createForecastJobBodySchema,
  forecastJobIdParamsSchema,
  listForecastJobsQuerySchema,
} from "../../../modules/forecasting/forecasting.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerForecastingRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (forecastingApp) => {
    forecastingApp.addHook("preHandler", activeOrganizationMiddleware);

    forecastingApp.post("/forecasting/jobs", async (request, reply) => {
      const body = createForecastJobBodySchema.parse(request.body);
      const result = await request.server.container.services.forecastJobService.createJob(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    forecastingApp.get("/forecasting/jobs", async (request) => {
      const query = listForecastJobsQuerySchema.parse(request.query);
      return request.server.container.services.forecastJobService.listJobs(request.requestContext, {
        ...(query.status ? { status: query.status } : {}),
      });
    });

    forecastingApp.get("/forecasting/jobs/:id", async (request) => {
      const params = forecastJobIdParamsSchema.parse(request.params);
      return request.server.container.services.forecastJobService.getJob(
        request.requestContext,
        params.id,
      );
    });

    forecastingApp.get("/forecasting/jobs/:id/results", async (request) => {
      const params = forecastJobIdParamsSchema.parse(request.params);
      return request.server.container.services.forecastJobService.listResults(
        request.requestContext,
        params.id,
      );
    });

    forecastingApp.post("/forecasting/jobs/:id/process", async (request) => {
      const params = forecastJobIdParamsSchema.parse(request.params);
      return request.server.container.services.forecastJobProcessorService.processJobForRequest(
        request.requestContext,
        params.id,
      );
    });
  });
};
