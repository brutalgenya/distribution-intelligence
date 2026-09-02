import type { FastifyInstance } from "fastify";

import {
  createSkuBodySchema,
  listSkusQuerySchema,
  skuIdParamsSchema,
  updateSkuBodySchema,
} from "../../../modules/catalog/catalog.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerCatalogRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (catalogApp) => {
    catalogApp.addHook("preHandler", activeOrganizationMiddleware);

    catalogApp.post("/catalog/skus", async (request, reply) => {
      const body = createSkuBodySchema.parse(request.body);
      const result = await request.server.container.services.catalogService.createSku(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    catalogApp.patch("/catalog/skus/:id", async (request) => {
      const params = skuIdParamsSchema.parse(request.params);
      const body = updateSkuBodySchema.parse(request.body);

      return request.server.container.services.catalogService.updateSku(
        request.requestContext,
        params.id,
        body,
      );
    });

    catalogApp.get("/catalog/skus", async (request) => {
      const query = listSkusQuerySchema.parse(request.query);
      return request.server.container.services.catalogService.listSkus(request.requestContext, {
        ...(query.status ? { status: query.status } : {}),
      });
    });

    catalogApp.get("/catalog/skus/:id", async (request) => {
      const params = skuIdParamsSchema.parse(request.params);
      return request.server.container.services.catalogService.getSku(request.requestContext, params.id);
    });
  });
};
