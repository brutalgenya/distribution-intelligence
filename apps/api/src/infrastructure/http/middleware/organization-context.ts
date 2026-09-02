import type { FastifyRequest } from "fastify";

import { organizationIdParamsSchema } from "../../../modules/tenancy/tenancy.schemas.js";
import { ForbiddenError } from "../../../shared/errors.js";

export const organizationContextMiddleware = async (request: FastifyRequest): Promise<void> => {
  const params = organizationIdParamsSchema.parse(request.params);
  const routeOrganizationId = params.id;

  if (
    request.requestContext.activeOrganizationId !== null &&
    request.requestContext.activeOrganizationId !== routeOrganizationId
  ) {
    throw new ForbiddenError("Active organization header does not match the requested organization.");
  }

  request.requestContext = {
    ...request.requestContext,
    activeOrganizationId: routeOrganizationId,
  };
};
