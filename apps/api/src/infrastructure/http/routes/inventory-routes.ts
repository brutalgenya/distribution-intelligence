import type { FastifyInstance } from "fastify";

import {
  createAdjustmentBodySchema,
  createLocationBodySchema,
  createReceiptBodySchema,
  createReservationBodySchema,
  createTransferBodySchema,
  inventoryPositionIdParamsSchema,
  listInventoryPositionsQuerySchema,
  listLocationsQuerySchema,
  reservationIdParamsSchema,
  transferIdParamsSchema,
} from "../../../modules/inventory/inventory.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerInventoryRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (inventoryApp) => {
    inventoryApp.addHook("preHandler", activeOrganizationMiddleware);

    inventoryApp.post("/inventory/locations", async (request, reply) => {
      const body = createLocationBodySchema.parse(request.body);
      const result = await request.server.container.services.locationService.createLocation(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    inventoryApp.get("/inventory/locations", async (request) => {
      const query = listLocationsQuerySchema.parse(request.query);
      return request.server.container.services.locationService.listLocations(request.requestContext, {
        ...(query.status ? { status: query.status } : {}),
      });
    });

    inventoryApp.get("/inventory/positions", async (request) => {
      const query = listInventoryPositionsQuerySchema.parse(request.query);
      return request.server.container.services.inventoryService.listPositions(request.requestContext, {
        ...(query.skuId ? { skuId: query.skuId } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
      });
    });

    inventoryApp.get("/inventory/positions/:id", async (request) => {
      const params = inventoryPositionIdParamsSchema.parse(request.params);
      return request.server.container.services.inventoryService.getPosition(
        request.requestContext,
        params.id,
      );
    });

    inventoryApp.post("/inventory/receipts", async (request, reply) => {
      const body = createReceiptBodySchema.parse(request.body);
      const result = await request.server.container.services.inventoryService.receiveInventory(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    inventoryApp.post("/inventory/adjustments", async (request, reply) => {
      const body = createAdjustmentBodySchema.parse(request.body);
      const result = await request.server.container.services.inventoryService.adjustInventory(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    inventoryApp.post("/inventory/reservations", async (request, reply) => {
      const body = createReservationBodySchema.parse(request.body);
      const result = await request.server.container.services.inventoryService.createReservation(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    inventoryApp.post("/inventory/reservations/:id/release", async (request) => {
      const params = reservationIdParamsSchema.parse(request.params);
      return request.server.container.services.inventoryService.releaseReservation(
        request.requestContext,
        params.id,
      );
    });

    inventoryApp.post("/inventory/transfers", async (request, reply) => {
      const body = createTransferBodySchema.parse(request.body);
      const result = await request.server.container.services.inventoryService.requestTransfer(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    inventoryApp.post("/inventory/transfers/:id/complete", async (request) => {
      const params = transferIdParamsSchema.parse(request.params);
      return request.server.container.services.inventoryService.completeTransfer(
        request.requestContext,
        params.id,
      );
    });
  });
};
