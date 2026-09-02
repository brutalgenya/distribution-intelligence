export interface AuthenticatedUserContext {
  id: string;
  email: string;
  displayName: string;
}

export interface RequestContext {
  correlationId: string;
  requestId?: string;
  traceId?: string | null;
  user: AuthenticatedUserContext;
  activeOrganizationId: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
    observabilityStartTimeNs?: bigint;
  }
}
