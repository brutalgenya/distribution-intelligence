import type { FastifyInstance } from "fastify";

import {
  createOrganizationBodySchema,
  inviteMemberBodySchema,
  organizationIdParamsSchema,
} from "../../../modules/tenancy/tenancy.schemas.js";
import { organizationContextMiddleware } from "../middleware/organization-context.js";

export const registerOrganizationRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/organizations", async (request, reply) => {
    const body = createOrganizationBodySchema.parse(request.body);
    const result = await request.server.container.services.organizationService.createOrganization(
      request.requestContext,
      body,
    );

    reply.status(201).send(result);
  });

  app.post(
    "/organizations/:id/invitations",
    {
      preHandler: organizationContextMiddleware,
    },
    async (request, reply) => {
      const params = organizationIdParamsSchema.parse(request.params);
      const body = inviteMemberBodySchema.parse(request.body);

      const result = await request.server.container.services.invitationService.inviteMember(
        request.requestContext,
        params.id,
        body,
      );

      reply.status(201).send(result);
    },
  );

  app.get(
    "/organizations/:id/memberships",
    {
      preHandler: organizationContextMiddleware,
    },
    async (request) => {
      const params = organizationIdParamsSchema.parse(request.params);
      return request.server.container.services.organizationService.listMemberships(
        request.requestContext,
        params.id,
      );
    },
  );

  app.get(
    "/organizations/:id/entitlements",
    {
      preHandler: organizationContextMiddleware,
    },
    async (request) => {
      const params = organizationIdParamsSchema.parse(request.params);
      return request.server.container.services.organizationService.listEntitlements(
        request.requestContext,
        params.id,
      );
    },
  );
};
