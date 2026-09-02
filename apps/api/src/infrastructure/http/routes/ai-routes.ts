import type { FastifyInstance } from "fastify";

import {
  aiRunIdParamsSchema,
  artifactIdParamsSchema,
  createModelRegistryEntryBodySchema,
  decisionIdParamsSchema,
  enhanceForecastBodySchema,
  listAiRunsQuerySchema,
  listAnomalyScoresQuerySchema,
  listDecisionExplanationsQuerySchema,
  listModelRegistryEntriesQuerySchema,
  modelRegistryEntryIdParamsSchema,
  scoreAnomalyBodySchema,
  updateModelRegistryEntryBodySchema,
} from "../../../modules/ai/ai.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerAiRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (aiApp) => {
    aiApp.addHook("preHandler", activeOrganizationMiddleware);

    aiApp.post("/ai/models", async (request) => {
      const body = createModelRegistryEntryBodySchema.parse(request.body);
      return request.server.container.services.modelRegistryService.createModelEntry(
        request.requestContext,
        body,
      );
    });

    aiApp.patch("/ai/models/:id", async (request) => {
      const params = modelRegistryEntryIdParamsSchema.parse(request.params);
      const body = updateModelRegistryEntryBodySchema.parse(request.body);
      return request.server.container.services.modelRegistryService.updateModelEntry(
        request.requestContext,
        params.id,
        body,
      );
    });

    aiApp.get("/ai/models", async (request) => {
      const query = listModelRegistryEntriesQuerySchema.parse(request.query);
      return request.server.container.services.modelRegistryService.listModelEntries(
        request.requestContext,
        {
          ...(query.modelType ? { modelType: query.modelType } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
      );
    });

    aiApp.get("/ai/models/:id", async (request) => {
      const params = modelRegistryEntryIdParamsSchema.parse(request.params);
      return request.server.container.services.modelRegistryService.getModelEntry(
        request.requestContext,
        params.id,
      );
    });

    aiApp.post("/ai/forecasting/enhance", async (request) => {
      const body = enhanceForecastBodySchema.parse(request.body);
      return request.server.container.services.forecastEnhancementService.enhanceForecastJob(
        request.requestContext,
        body,
      );
    });

    aiApp.get("/ai/forecasting/runs", async (request) => {
      const query = listAiRunsQuerySchema.parse(request.query);
      return request.server.container.services.forecastEnhancementService.listRuns(
        request.requestContext,
        {
          ...(query.status ? { status: query.status } : {}),
        },
      );
    });

    aiApp.get("/ai/forecasting/runs/:id", async (request) => {
      const params = aiRunIdParamsSchema.parse(request.params);
      return request.server.container.services.forecastEnhancementService.getRun(
        request.requestContext,
        params.id,
      );
    });

    aiApp.post("/ai/anomalies/score", async (request) => {
      const body = scoreAnomalyBodySchema.parse(request.body);
      return request.server.container.services.anomalyScoringService.scoreAnomaly(
        request.requestContext,
        body,
      );
    });

    aiApp.get("/ai/anomalies", async (request) => {
      const query = listAnomalyScoresQuerySchema.parse(request.query);
      return request.server.container.services.anomalyScoringService.listScores(
        request.requestContext,
        {
          ...(query.skuId ? { skuId: query.skuId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
        },
      );
    });

    aiApp.get("/ai/anomalies/:id", async (request) => {
      const params = artifactIdParamsSchema.parse(request.params);
      return request.server.container.services.anomalyScoringService.getScore(
        request.requestContext,
        params.id,
      );
    });

    aiApp.post("/ai/decisions/:decisionId/explain", async (request) => {
      const params = decisionIdParamsSchema.parse(request.params);
      return request.server.container.services.decisionExplanationService.generateExplanation(
        request.requestContext,
        params.decisionId,
      );
    });

    aiApp.get("/ai/decisions/explanations", async (request) => {
      const query = listDecisionExplanationsQuerySchema.parse(request.query);
      return request.server.container.services.decisionExplanationService.listExplanations(
        request.requestContext,
        {
          ...(query.decisionId ? { decisionId: query.decisionId } : {}),
        },
      );
    });

    aiApp.get("/ai/decisions/explanations/:id", async (request) => {
      const params = artifactIdParamsSchema.parse(request.params);
      return request.server.container.services.decisionExplanationService.getExplanation(
        request.requestContext,
        params.id,
      );
    });

    aiApp.get("/ai/runs", async (request) => {
      const query = listAiRunsQuerySchema.parse(request.query);
      return request.server.container.services.aiRunService.listRuns(request.requestContext, {
        ...(query.runType ? { runType: query.runType } : {}),
        ...(query.status ? { status: query.status } : {}),
      });
    });

    aiApp.get("/ai/runs/:id", async (request) => {
      const params = aiRunIdParamsSchema.parse(request.params);
      return request.server.container.services.aiRunService.getRun(request.requestContext, params.id);
    });
  });
};
