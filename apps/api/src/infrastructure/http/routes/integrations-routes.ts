import type { FastifyInstance } from "fastify";

import {
  createIntegrationConnectionBodySchema,
  createIntegrationSyncRunBodySchema,
  integrationConnectionIdParamsSchema,
  integrationFailedRecordIdParamsSchema,
  integrationSyncRunIdParamsSchema,
  listIntegrationConnectionsQuerySchema,
  listIntegrationFailedRecordsQuerySchema,
  listIntegrationSyncRunsQuerySchema,
  updateIntegrationConnectionBodySchema,
} from "../../../modules/integrations/integration.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerIntegrationsRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (integrationsApp) => {
    integrationsApp.addHook("preHandler", activeOrganizationMiddleware);

    integrationsApp.post("/integrations/connections", async (request, reply) => {
      const body = createIntegrationConnectionBodySchema.parse(request.body);
      const result = await request.server.container.services.integrationConnectionService.createConnection(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    integrationsApp.patch("/integrations/connections/:id", async (request) => {
      const params = integrationConnectionIdParamsSchema.parse(request.params);
      const body = updateIntegrationConnectionBodySchema.parse(request.body);
      return request.server.container.services.integrationConnectionService.updateConnection(
        request.requestContext,
        params.id,
        body,
      );
    });

    integrationsApp.get("/integrations/connections", async (request) => {
      const query = listIntegrationConnectionsQuerySchema.parse(request.query);
      return request.server.container.services.integrationConnectionService.listConnections(request.requestContext, {
        ...(query.integrationType ? { integrationType: query.integrationType } : {}),
        ...(query.status ? { status: query.status } : {}),
      });
    });

    integrationsApp.get("/integrations/connections/:id", async (request) => {
      const params = integrationConnectionIdParamsSchema.parse(request.params);
      return request.server.container.services.integrationConnectionService.getConnection(
        request.requestContext,
        params.id,
      );
    });

    integrationsApp.post("/integrations/syncs", async (request, reply) => {
      const body = createIntegrationSyncRunBodySchema.parse(request.body);
      const result = await request.server.container.services.integrationSyncService.createSyncRun(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    integrationsApp.post("/integrations/syncs/:id/process", async (request) => {
      const params = integrationSyncRunIdParamsSchema.parse(request.params);
      return request.server.container.services.integrationSyncService.processSyncRun(
        request.requestContext,
        params.id,
      );
    });

    integrationsApp.get("/integrations/syncs", async (request) => {
      const query = listIntegrationSyncRunsQuerySchema.parse(request.query);
      return request.server.container.services.integrationSyncService.listSyncRuns(request.requestContext, {
        ...(query.connectionId ? { integrationConnectionId: query.connectionId } : {}),
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.syncType ? { syncType: query.syncType } : {}),
        ...(query.status ? { status: query.status } : {}),
      });
    });

    integrationsApp.get("/integrations/syncs/:id", async (request) => {
      const params = integrationSyncRunIdParamsSchema.parse(request.params);
      return request.server.container.services.integrationSyncService.getSyncRun(
        request.requestContext,
        params.id,
      );
    });

    integrationsApp.get("/integrations/failed-records", async (request) => {
      const query = listIntegrationFailedRecordsQuerySchema.parse(request.query);
      return request.server.container.services.integrationSyncService.listFailedRecords(
        request.requestContext,
        {
          ...(query.connectionId ? { integrationConnectionId: query.connectionId } : {}),
          ...(query.syncRunId ? { syncRunId: query.syncRunId } : {}),
          ...(query.resolved !== undefined ? { resolved: query.resolved } : {}),
        },
      );
    });

    integrationsApp.get("/integrations/failed-records/:id", async (request) => {
      const params = integrationFailedRecordIdParamsSchema.parse(request.params);
      return request.server.container.services.integrationSyncService.getFailedRecord(
        request.requestContext,
        params.id,
      );
    });
  });
};
