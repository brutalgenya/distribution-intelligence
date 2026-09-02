import type { FastifyInstance } from "fastify";

import {
  createPurchaseOrderBodySchema,
  createSupplierBodySchema,
  createSupplierSkuBodySchema,
  delayPurchaseOrderBodySchema,
  listPurchaseOrdersQuerySchema,
  listSupplierSkusQuerySchema,
  listSuppliersQuerySchema,
  purchaseOrderIdParamsSchema,
  receivePurchaseOrderBodySchema,
  skuScopedParamsSchema,
  supplierIdParamsSchema,
  supplierScopedParamsSchema,
  supplierSkuIdParamsSchema,
  updateSupplierBodySchema,
  updateSupplierSkuBodySchema,
} from "../../../modules/supply/supply.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerSupplyRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (supplyApp) => {
    supplyApp.addHook("preHandler", activeOrganizationMiddleware);

    supplyApp.post("/supply/suppliers", async (request, reply) => {
      const body = createSupplierBodySchema.parse(request.body);
      const result = await request.server.container.services.supplierService.createSupplier(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    supplyApp.patch("/supply/suppliers/:id", async (request) => {
      const params = supplierIdParamsSchema.parse(request.params);
      const body = updateSupplierBodySchema.parse(request.body);
      return request.server.container.services.supplierService.updateSupplier(
        request.requestContext,
        params.id,
        body,
      );
    });

    supplyApp.get("/supply/suppliers", async (request) => {
      const query = listSuppliersQuerySchema.parse(request.query);
      return request.server.container.services.supplierService.listSuppliers(request.requestContext, {
        ...(query.status ? { status: query.status } : {}),
      });
    });

    supplyApp.get("/supply/suppliers/:id", async (request) => {
      const params = supplierIdParamsSchema.parse(request.params);
      return request.server.container.services.supplierService.getSupplier(request.requestContext, params.id);
    });

    supplyApp.get("/supply/suppliers/:id/performance", async (request) => {
      const params = supplierIdParamsSchema.parse(request.params);
      return request.server.container.services.supplyAnalyticsService.getSupplierPerformance(
        request.requestContext,
        params.id,
      );
    });

    supplyApp.get("/supply/suppliers/:id/lead-time-stats", async (request) => {
      const params = supplierIdParamsSchema.parse(request.params);
      return request.server.container.services.supplyAnalyticsService.listLeadTimeStats(
        request.requestContext,
        params.id,
      );
    });

    supplyApp.post("/supply/supplier-skus", async (request, reply) => {
      const body = createSupplierSkuBodySchema.parse(request.body);
      const result = await request.server.container.services.supplierSkuService.createMapping(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    supplyApp.patch("/supply/supplier-skus/:id", async (request) => {
      const params = supplierSkuIdParamsSchema.parse(request.params);
      const body = updateSupplierSkuBodySchema.parse(request.body);
      return request.server.container.services.supplierSkuService.updateMapping(
        request.requestContext,
        params.id,
        body,
      );
    });

    supplyApp.get("/supply/supplier-skus", async (request) => {
      const query = listSupplierSkusQuerySchema.parse(request.query);
      return request.server.container.services.supplierSkuService.listMappings(request.requestContext, {
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.skuId ? { skuId: query.skuId } : {}),
        ...(query.isPrimary !== undefined ? { isPrimary: query.isPrimary } : {}),
      });
    });

    supplyApp.get("/supply/supplier-skus/by-supplier/:supplierId", async (request) => {
      const params = supplierScopedParamsSchema.parse(request.params);
      return request.server.container.services.supplierSkuService.listMappings(request.requestContext, {
        supplierId: params.supplierId,
      });
    });

    supplyApp.get("/supply/supplier-skus/by-sku/:skuId", async (request) => {
      const params = skuScopedParamsSchema.parse(request.params);
      return request.server.container.services.supplierSkuService.listMappings(request.requestContext, {
        skuId: params.skuId,
      });
    });

    supplyApp.post("/supply/purchase-orders", async (request, reply) => {
      const body = createPurchaseOrderBodySchema.parse(request.body);
      const result = await request.server.container.services.purchaseOrderService.createDraft(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    supplyApp.post("/supply/purchase-orders/:id/submit", async (request) => {
      const params = purchaseOrderIdParamsSchema.parse(request.params);
      return request.server.container.services.purchaseOrderService.submitPurchaseOrder(
        request.requestContext,
        params.id,
      );
    });

    supplyApp.post("/supply/purchase-orders/:id/delay", async (request) => {
      const params = purchaseOrderIdParamsSchema.parse(request.params);
      const body = delayPurchaseOrderBodySchema.parse(request.body ?? {});
      return request.server.container.services.purchaseOrderService.delayPurchaseOrder(
        request.requestContext,
        params.id,
        body,
      );
    });

    supplyApp.post("/supply/purchase-orders/:id/receive", async (request) => {
      const params = purchaseOrderIdParamsSchema.parse(request.params);
      const body = receivePurchaseOrderBodySchema.parse(request.body);
      return request.server.container.services.purchaseOrderService.receivePurchaseOrder(
        request.requestContext,
        params.id,
        body,
      );
    });

    supplyApp.get("/supply/purchase-orders", async (request) => {
      const query = listPurchaseOrdersQuerySchema.parse(request.query);
      return request.server.container.services.purchaseOrderService.listPurchaseOrders(
        request.requestContext,
        {
          ...(query.status ? { status: query.status } : {}),
          ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        },
      );
    });

    supplyApp.get("/supply/purchase-orders/:id", async (request) => {
      const params = purchaseOrderIdParamsSchema.parse(request.params);
      return request.server.container.services.purchaseOrderService.getPurchaseOrder(
        request.requestContext,
        params.id,
      );
    });
  });
};
