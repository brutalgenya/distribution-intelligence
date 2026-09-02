import type { FastifyInstance } from "fastify";

import {
  createCustomerOrderBodySchema,
  customerOrderIdParamsSchema,
  listCustomerOrdersQuerySchema,
  listSalesImportRunsQuerySchema,
  salesImportBodySchema,
  salesImportRunIdParamsSchema,
} from "../../../modules/demand/demand.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerDemandRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (demandApp) => {
    demandApp.addHook("preHandler", activeOrganizationMiddleware);

    demandApp.post("/demand/sales/import", async (request, reply) => {
      const body = salesImportBodySchema.parse(request.body);
      const result = await request.server.container.services.salesImportService.importSales(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    demandApp.get("/demand/sales/import-runs", async (request) => {
      const query = listSalesImportRunsQuerySchema.parse(request.query);
      return request.server.container.services.salesImportService.listImportRuns(request.requestContext, {
        ...(query.status ? { status: query.status } : {}),
      });
    });

    demandApp.get("/demand/sales/import-runs/:id", async (request) => {
      const params = salesImportRunIdParamsSchema.parse(request.params);
      return request.server.container.services.salesImportService.getImportRun(
        request.requestContext,
        params.id,
      );
    });

    demandApp.post("/demand/orders", async (request, reply) => {
      const body = createCustomerOrderBodySchema.parse(request.body);
      const result = await request.server.container.services.customerOrderService.createOrder(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    demandApp.post("/demand/orders/:id/cancel", async (request) => {
      const params = customerOrderIdParamsSchema.parse(request.params);
      return request.server.container.services.customerOrderService.cancelOrder(
        request.requestContext,
        params.id,
      );
    });

    demandApp.get("/demand/orders", async (request) => {
      const query = listCustomerOrdersQuerySchema.parse(request.query);
      return request.server.container.services.customerOrderService.listOrders(request.requestContext, {
        ...(query.status ? { status: query.status } : {}),
      });
    });

    demandApp.get("/demand/orders/:id", async (request) => {
      const params = customerOrderIdParamsSchema.parse(request.params);
      return request.server.container.services.customerOrderService.getOrder(
        request.requestContext,
        params.id,
      );
    });
  });
};
