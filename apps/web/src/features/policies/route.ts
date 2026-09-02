import type { PoliciesRouteParams } from "./types";

export const buildPoliciesHref = (
  params: Partial<PoliciesRouteParams> = {},
): string => {
  const searchParams = new URLSearchParams();

  if (params.policyId) {
    searchParams.set("policyId", params.policyId);
  }

  if (params.policyType && params.policyType !== "all") {
    searchParams.set("policyType", params.policyType);
  }

  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/policies?${queryString}` : "/policies";
};

export const readPoliciesRouteParams = (
  searchParams: URLSearchParams,
): PoliciesRouteParams => ({
  policyId: searchParams.get("policyId"),
  policyType: (searchParams.get("policyType") as PoliciesRouteParams["policyType"]) ?? "all",
  status: (searchParams.get("status") as PoliciesRouteParams["status"]) ?? "all",
});
