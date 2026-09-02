import type { IntegrationConnectionFilters, IntegrationsRouteParams } from "./types";

export const buildIntegrationsHref = (
  params: Partial<IntegrationsRouteParams> = {},
): string => {
  const searchParams = new URLSearchParams();

  if (params.integrationConnectionId) {
    searchParams.set("integrationConnectionId", params.integrationConnectionId);
  }

  if (params.syncRunId) {
    searchParams.set("syncRunId", params.syncRunId);
  }

  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.integrationType && params.integrationType !== "all") {
    searchParams.set("integrationType", params.integrationType);
  }

  if (params.search && params.search.trim().length > 0) {
    searchParams.set("search", params.search.trim());
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/integrations?${queryString}` : "/integrations";
};

export const readIntegrationsRouteParams = (
  searchParams: URLSearchParams,
): IntegrationsRouteParams => ({
  integrationConnectionId: searchParams.get("integrationConnectionId"),
  syncRunId: searchParams.get("syncRunId"),
  status: (searchParams.get("status") as IntegrationConnectionFilters["status"]) ?? "all",
  integrationType:
    (searchParams.get("integrationType") as IntegrationConnectionFilters["integrationType"]) ??
    "all",
  search: searchParams.get("search") ?? "",
});
