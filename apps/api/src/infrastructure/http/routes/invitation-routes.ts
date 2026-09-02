import type { FastifyInstance } from "fastify";

import { acceptInvitationBodySchema } from "../../../modules/tenancy/tenancy.schemas.js";

export const registerInvitationRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/invitations/accept", async (request) => {
    const body = acceptInvitationBodySchema.parse(request.body);

    return request.server.container.services.invitationService.acceptInvitation(
      request.requestContext,
      body,
    );
  });
};
