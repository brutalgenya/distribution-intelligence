import type { FastifyRequest } from "fastify";

import { requireActiveOrganizationId } from "../../../shared/organization-context.js";

export const activeOrganizationMiddleware = async (request: FastifyRequest): Promise<void> => {
  requireActiveOrganizationId(request.requestContext);
};
