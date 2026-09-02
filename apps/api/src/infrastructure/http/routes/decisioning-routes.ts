import type { FastifyInstance } from "fastify";

import {
  createPolicyBodySchema,
  decisionIdParamsSchema,
  generateAllocationBodySchema,
  generateExceptionBodySchema,
  generateReplenishmentBatchBodySchema,
  generateReplenishmentBodySchema,
  listDecisionsQuerySchema,
  listPoliciesQuerySchema,
  policyIdParamsSchema,
  policyTypeParamsSchema,
  skuScopedParamsSchema,
  updatePolicyBodySchema,
} from "../../../modules/decisioning/decisioning.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerDecisioningRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (decisioningApp) => {
    decisioningApp.addHook("preHandler", activeOrganizationMiddleware);

    decisioningApp.post("/decisioning/policies", async (request, reply) => {
      const body = createPolicyBodySchema.parse(request.body);
      const result = await request.server.container.services.policyService.createPolicy(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    decisioningApp.patch("/decisioning/policies/:id", async (request) => {
      const params = policyIdParamsSchema.parse(request.params);
      const body = updatePolicyBodySchema.parse(request.body);
      return request.server.container.services.policyService.updateDraftPolicy(
        request.requestContext,
        params.id,
        body,
      );
    });

    decisioningApp.post("/decisioning/policies/:id/activate", async (request) => {
      const params = policyIdParamsSchema.parse(request.params);
      return request.server.container.services.policyService.activatePolicy(
        request.requestContext,
        params.id,
      );
    });

    decisioningApp.get("/decisioning/policies", async (request) => {
      const query = listPoliciesQuerySchema.parse(request.query);
      return request.server.container.services.policyService.listPolicies(request.requestContext, {
        ...(query.policyType ? { policyType: query.policyType } : {}),
        ...(query.status ? { status: query.status } : {}),
      });
    });

    decisioningApp.get("/decisioning/policies/active/:policyType", async (request) => {
      const params = policyTypeParamsSchema.parse(request.params);
      return request.server.container.services.policyService.getActivePolicy(
        request.requestContext,
        params.policyType,
      );
    });

    decisioningApp.get("/decisioning/policies/:id", async (request) => {
      const params = policyIdParamsSchema.parse(request.params);
      return request.server.container.services.policyService.getPolicy(
        request.requestContext,
        params.id,
      );
    });

    decisioningApp.post("/decisioning/replenishment/generate", async (request) => {
      const body = generateReplenishmentBodySchema.parse(request.body);
      return request.server.container.services.replenishmentDecisionService.generateForScope(
        request.requestContext,
        body,
      );
    });

    decisioningApp.post("/decisioning/replenishment/generate-batch", async (request) => {
      const body = generateReplenishmentBatchBodySchema.parse(request.body ?? {});
      return request.server.container.services.replenishmentDecisionService.generateBatch(
        request.requestContext,
        body,
      );
    });

    decisioningApp.post("/decisioning/allocation/generate", async (request) => {
      const body = generateAllocationBodySchema.parse(request.body);
      return request.server.container.services.allocationDecisionService.generateForScope(
        request.requestContext,
        body,
      );
    });

    decisioningApp.post("/decisioning/exceptions/generate", async (request) => {
      const body = generateExceptionBodySchema.parse(request.body);
      return request.server.container.services.exceptionDecisionService.generateForScope(
        request.requestContext,
        body,
      );
    });

    decisioningApp.get("/decisioning/decisions", async (request) => {
      const query = listDecisionsQuerySchema.parse(request.query);
      return request.server.container.services.decisionReadService.listDecisions(
        request.requestContext,
        {
          ...(query.decisionType ? { decisionType: query.decisionType } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.skuId ? { skuId: query.skuId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
        },
      );
    });

    decisioningApp.get("/decisioning/decisions/by-sku/:skuId", async (request) => {
      const params = skuScopedParamsSchema.parse(request.params);
      const query = listDecisionsQuerySchema.parse(request.query);
      return request.server.container.services.decisionReadService.listDecisionsBySku(
        request.requestContext,
        params.skuId,
        {
          ...(query.decisionType ? { decisionType: query.decisionType } : {}),
        },
      );
    });

    decisioningApp.get("/decisioning/decisions/:id", async (request) => {
      const params = decisionIdParamsSchema.parse(request.params);
      return request.server.container.services.decisionReadService.getDecision(
        request.requestContext,
        params.id,
      );
    });
  });
};
