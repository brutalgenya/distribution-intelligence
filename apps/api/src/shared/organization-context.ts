import { BadRequestError } from "./errors.js";
import type { RequestContext } from "./request-context.js";

export const requireActiveOrganizationId = (context: RequestContext): string => {
  if (context.activeOrganizationId === null) {
    throw new BadRequestError("An active organization context is required for this route.");
  }

  return context.activeOrganizationId;
};
