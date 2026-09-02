import type { FastifyInstance } from "fastify";

import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerObservabilityRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/observability/health", async (_request, reply) => {
    const health = await app.container.services.observabilityService.getHealth();
    reply.status(health.status === "ok" ? 200 : 503).send(health);
  });
  app.get("/observability/live", async () => app.container.services.observabilityService.getLiveness());
  app.get("/observability/ready", async (_request, reply) => {
    const readiness = await app.container.services.observabilityService.getReadiness();
    reply.status(readiness.status === "ready" ? 200 : 503).send(readiness);
  });

  await app.register(async (securedApp) => {
    securedApp.addHook("preHandler", activeOrganizationMiddleware);

    securedApp.get("/observability/metrics", async (request) =>
      request.server.container.services.observabilityService.getMetrics(request.requestContext),
    );
  });
};
