import type { FastifyInstance } from "fastify";

import {
  computeDecisionOutcomesBodySchema,
  computeFillRateBodySchema,
  computeForecastErrorBodySchema,
  computePolicyEffectivenessBodySchema,
  computeStockoutsBodySchema,
  decisionScopedParamsSchema,
  listDecisionOutcomesQuerySchema,
  listFillRateMeasurementsQuerySchema,
  listForecastErrorMeasurementsQuerySchema,
  listPolicyEffectivenessSummariesQuerySchema,
  listStockoutIncidentsQuerySchema,
  outcomeIdParamsSchema,
  policyScopedParamsSchema,
} from "../../../modules/outcomes/outcomes.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerOutcomesRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (outcomesApp) => {
    outcomesApp.addHook("preHandler", activeOrganizationMiddleware);

    outcomesApp.post("/outcomes/stockouts/compute", async (request) => {
      const body = computeStockoutsBodySchema.parse(request.body);
      return request.server.container.services.stockoutDetectionService.computeStockouts(
        request.requestContext,
        body,
      );
    });

    outcomesApp.get("/outcomes/stockouts", async (request) => {
      const query = listStockoutIncidentsQuerySchema.parse(request.query);
      return request.server.container.services.stockoutDetectionService.listIncidents(
        request.requestContext,
        {
          ...(query.skuId ? { skuId: query.skuId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
        },
      );
    });

    outcomesApp.get("/outcomes/stockouts/:id", async (request) => {
      const params = outcomeIdParamsSchema.parse(request.params);
      return request.server.container.services.stockoutDetectionService.getIncident(
        request.requestContext,
        params.id,
      );
    });

    outcomesApp.post("/outcomes/fill-rate/compute", async (request) => {
      const body = computeFillRateBodySchema.parse(request.body);
      return request.server.container.services.fillRateService.computeFillRate(
        request.requestContext,
        body,
      );
    });

    outcomesApp.get("/outcomes/fill-rate", async (request) => {
      const query = listFillRateMeasurementsQuerySchema.parse(request.query);
      return request.server.container.services.fillRateService.listMeasurements(
        request.requestContext,
        {
          ...(query.skuId ? { skuId: query.skuId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
        },
      );
    });

    outcomesApp.get("/outcomes/fill-rate/:id", async (request) => {
      const params = outcomeIdParamsSchema.parse(request.params);
      return request.server.container.services.fillRateService.getMeasurement(
        request.requestContext,
        params.id,
      );
    });

    outcomesApp.post("/outcomes/forecast-error/compute", async (request) => {
      const body = computeForecastErrorBodySchema.parse(request.body);
      return request.server.container.services.forecastErrorService.computeForecastError(
        request.requestContext,
        body,
      );
    });

    outcomesApp.get("/outcomes/forecast-error", async (request) => {
      const query = listForecastErrorMeasurementsQuerySchema.parse(request.query);
      return request.server.container.services.forecastErrorService.listMeasurements(
        request.requestContext,
        {
          ...(query.skuId ? { skuId: query.skuId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
          ...(query.forecastJobId ? { forecastJobId: query.forecastJobId } : {}),
        },
      );
    });

    outcomesApp.get("/outcomes/forecast-error/:id", async (request) => {
      const params = outcomeIdParamsSchema.parse(request.params);
      return request.server.container.services.forecastErrorService.getMeasurement(
        request.requestContext,
        params.id,
      );
    });

    outcomesApp.post("/outcomes/decisions/compute", async (request) => {
      const body = computeDecisionOutcomesBodySchema.parse(request.body);
      return request.server.container.services.decisionOutcomeService.computeDecisionOutcomes(
        request.requestContext,
        body,
      );
    });

    outcomesApp.get("/outcomes/decisions", async (request) => {
      const query = listDecisionOutcomesQuerySchema.parse(request.query);
      return request.server.container.services.decisionOutcomeService.listDecisionOutcomes(
        request.requestContext,
        {
          ...(query.decisionId ? { decisionId: query.decisionId } : {}),
          ...(query.outcomeStatus ? { outcomeStatus: query.outcomeStatus } : {}),
        },
      );
    });

    outcomesApp.get("/outcomes/decisions/by-decision/:decisionId", async (request) => {
      const params = decisionScopedParamsSchema.parse(request.params);
      return request.server.container.services.decisionOutcomeService.listOutcomesByDecision(
        request.requestContext,
        params.decisionId,
      );
    });

    outcomesApp.get("/outcomes/decisions/:id", async (request) => {
      const params = outcomeIdParamsSchema.parse(request.params);
      return request.server.container.services.decisionOutcomeService.getDecisionOutcome(
        request.requestContext,
        params.id,
      );
    });

    outcomesApp.post("/outcomes/policies/compute", async (request) => {
      const body = computePolicyEffectivenessBodySchema.parse(request.body);
      return request.server.container.services.policyEffectivenessService.computePolicyEffectiveness(
        request.requestContext,
        body,
      );
    });

    outcomesApp.get("/outcomes/policies", async (request) => {
      const query = listPolicyEffectivenessSummariesQuerySchema.parse(request.query);
      return request.server.container.services.policyEffectivenessService.listSummaries(
        request.requestContext,
        {
          ...(query.policyId ? { policyId: query.policyId } : {}),
        },
      );
    });

    outcomesApp.get("/outcomes/policies/by-policy/:policyId", async (request) => {
      const params = policyScopedParamsSchema.parse(request.params);
      return request.server.container.services.policyEffectivenessService.listSummariesByPolicy(
        request.requestContext,
        params.policyId,
      );
    });

    outcomesApp.get("/outcomes/policies/:id", async (request) => {
      const params = outcomeIdParamsSchema.parse(request.params);
      return request.server.container.services.policyEffectivenessService.getSummary(
        request.requestContext,
        params.id,
      );
    });
  });
};
