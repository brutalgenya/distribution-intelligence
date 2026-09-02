import type { SupportActionsRouteParams } from "./types";

export const buildSupportActionsHref = (
  params: Partial<SupportActionsRouteParams> = {},
): string => {
  const searchParams = new URLSearchParams();

  if (params.executionId) {
    searchParams.set("executionId", params.executionId);
  }

  if (params.forecastJobId) {
    searchParams.set("forecastJobId", params.forecastJobId);
  }

  if (params.integrationConnectionId) {
    searchParams.set("integrationConnectionId", params.integrationConnectionId);
  }

  if (params.syncRunId) {
    searchParams.set("syncRunId", params.syncRunId);
  }

  if (params.skuId) {
    searchParams.set("skuId", params.skuId);
  }

  if (params.locationId) {
    searchParams.set("locationId", params.locationId);
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/support-actions?${queryString}` : "/support-actions";
};

export const readSupportActionsRouteParams = (
  searchParams: URLSearchParams,
): SupportActionsRouteParams => ({
  executionId: searchParams.get("executionId"),
  forecastJobId: searchParams.get("forecastJobId"),
  integrationConnectionId: searchParams.get("integrationConnectionId"),
  syncRunId: searchParams.get("syncRunId"),
  skuId: searchParams.get("skuId"),
  locationId: searchParams.get("locationId"),
});
