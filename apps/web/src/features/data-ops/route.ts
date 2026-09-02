export interface DataOpsRouteParams {
  skuId?: string | null;
  locationId?: string | null;
  forecastJobId?: string | null;
  integrationConnectionId?: string | null;
  syncRunId?: string | null;
}

export const buildDataOpsHref = (params: DataOpsRouteParams = {}): string => {
  const searchParams = new URLSearchParams();

  if (params.skuId) {
    searchParams.set("skuId", params.skuId);
  }

  if (params.locationId) {
    searchParams.set("locationId", params.locationId);
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

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/data-ops?${queryString}` : "/data-ops";
};
